package router

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sort"

	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	apidiscoveryv2beta1 "k8s.io/api/apidiscovery/v2beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	utilruntime "k8s.io/apimachinery/pkg/util/runtime"
	"k8s.io/apiserver/pkg/endpoints"
	"k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
	"k8s.io/apiserver/pkg/endpoints/handlers/negotiation"
	"k8s.io/kube-openapi/pkg/handler3"
)

const aggregatedDiscoveryJSON = "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList"

var discoveryCodecs = func() serializer.CodecFactory {
	scheme := runtime.NewScheme()
	utilruntime.Must(apidiscoveryv2.AddToScheme(scheme))
	utilruntime.Must(apidiscoveryv2beta1.AddToScheme(scheme))
	return serializer.NewCodecFactory(scheme)
}()

func (cr *GrafanaRouter) serveAPIGroupList(w http.ResponseWriter, req *http.Request, next http.Handler) {
	w.Header().Set("Vary", "Accept")
	mediaType, _ := negotiation.NegotiateMediaTypeOptions(req.Header.Get("Accept"), discoveryCodecs.SupportedMediaTypes(), aggregated.DiscoveryEndpointRestrictions)
	if aggregated.IsAggregatedDiscoveryGVK(mediaType.Convert) {
		cr.serveAggregatedDiscovery(w, req, next)
		return
	}

	var fallback metav1.APIGroupList
	if _, err := readDiscovery(req, next, apisPrefix, "application/json", &fallback); err != nil || fallback.Kind != "APIGroupList" {
		serveCachedDoc(w, req, cr.apiGroupList.Load())
		return
	}
	groups := make(map[string]metav1.APIGroup, len(fallback.Groups))
	for _, group := range fallback.Groups {
		groups[group.Name] = group
	}
	for name, entry := range *cr.snapshot.Load() {
		groups[name] = entry.group
	}
	fallback.Groups = make([]metav1.APIGroup, 0, len(groups))
	for _, group := range groups {
		fallback.Groups = append(fallback.Groups, group)
	}
	sort.Slice(fallback.Groups, func(i, j int) bool { return fallback.Groups[i].Name < fallback.Groups[j].Name })
	serveDiscoveryJSON(w, req, fallback)
}

func (cr *GrafanaRouter) serveAggregatedDiscovery(w http.ResponseWriter, req *http.Request, next http.Handler) {
	groups := map[string]apidiscoveryv2.APIGroupDiscovery{}
	var fallback apidiscoveryv2.APIGroupDiscoveryList
	if _, err := readDiscovery(req, next, apisPrefix, aggregatedDiscoveryJSON, &fallback); err == nil && fallback.Kind == "APIGroupDiscoveryList" {
		for _, group := range fallback.Items {
			groups[group.Name] = group
		}
	}
	for name, entry := range *cr.snapshot.Load() {
		// A backend owns the entire group, including which versions are served.
		// Never keep fallback versions of a group the router has taken over.
		groups[name] = backendDiscovery(req, name, entry)
	}
	items := make([]apidiscoveryv2.APIGroupDiscovery, 0, len(groups))
	for _, group := range groups {
		items = append(items, group)
	}
	manager := aggregated.NewResourceManager("apis")
	manager.SetGroups(items)
	for _, group := range items {
		for i, version := range group.Versions {
			manager.SetGroupVersionPriority(metav1.GroupVersion{Group: group.Name, Version: version.Version}, 1000, len(group.Versions)-i)
		}
	}
	manager.ServeHTTP(w, req)
}

func backendDiscovery(req *http.Request, name string, entry servingEntry) apidiscoveryv2.APIGroupDiscovery {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		serveThroughBreaker(entry.breaker, entry.handler, w, r)
	})
	var list apidiscoveryv2.APIGroupDiscoveryList
	status, err := readDiscovery(req, handler, apisPrefix, aggregatedDiscoveryJSON, &list)
	if err == nil && list.Kind == "APIGroupDiscoveryList" {
		for _, group := range list.Items {
			if group.Name == name {
				return group
			}
		}
	}

	group := apidiscoveryv2.APIGroupDiscovery{ObjectMeta: metav1.ObjectMeta{Name: name}}
	for _, gv := range entry.group.Versions {
		version := apidiscoveryv2.APIVersionDiscovery{Version: gv.Version, Freshness: apidiscoveryv2.DiscoveryFreshnessStale}
		// Older backends may only support per-version resource discovery. An
		// unavailable backend stays advertised as stale without hiding healthy groups.
		if status == http.StatusOK || status == http.StatusNotFound {
			var resources metav1.APIResourceList
			if _, err := readDiscovery(req, handler, apisPrefix+"/"+gv.GroupVersion, "application/json", &resources); err == nil && resources.Kind == "APIResourceList" {
				if converted, err := endpoints.ConvertGroupVersionIntoToDiscovery(resources.APIResources); err == nil {
					version.Resources = converted
					version.Freshness = apidiscoveryv2.DiscoveryFreshnessCurrent
				}
			}
		}
		group.Versions = append(group.Versions, version)
	}
	return group
}

func (cr *GrafanaRouter) serveOpenAPIIndex(w http.ResponseWriter, req *http.Request, next http.Handler) {
	var fallback handler3.OpenAPIV3Discovery
	if _, err := readDiscovery(req, next, openapiV3Prefix, "application/json", &fallback); err != nil || fallback.Paths == nil {
		serveCachedDoc(w, req, cr.openapiIndex.Load())
		return
	}
	handlers := *cr.snapshot.Load()
	for path := range fallback.Paths {
		group, _, ok := parseOpenAPIGroupVersionPath(openapiV3Prefix + "/" + path)
		if _, owned := handlers[group]; ok && owned {
			delete(fallback.Paths, path)
		}
	}
	for _, entry := range handlers {
		for _, gv := range entry.group.Versions {
			path := "apis/" + gv.GroupVersion
			fallback.Paths[path] = handler3.OpenAPIV3DiscoveryGroupVersion{
				ServerRelativeURL: fmt.Sprintf("%s/%s?hash=%s", openapiV3Prefix, path, entry.key),
			}
		}
	}
	serveDiscoveryJSON(w, req, fallback)
}

func readDiscovery(req *http.Request, handler http.Handler, path, accept string, into any) (int, error) {
	proxyReq := req.Clone(req.Context())
	proxyReq.Method = http.MethodGet
	proxyReq.Body = nil
	proxyReq.ContentLength = 0
	proxyReq.URL.Path = path
	proxyReq.URL.RawPath = ""
	proxyReq.URL.RawQuery = ""
	proxyReq.RequestURI = path
	proxyReq.Header.Set("Accept", accept)
	proxyReq.Header.Set("Accept-Encoding", "identity")
	stripConditionalHeaders(proxyReq)
	rec := newCaptureWriter()
	handler.ServeHTTP(rec, proxyReq)
	if rec.statusCode != http.StatusOK {
		return rec.statusCode, fmt.Errorf("discovery %s returned HTTP %d", path, rec.statusCode)
	}
	return rec.statusCode, json.Unmarshal(rec.body.Bytes(), into)
}

func serveDiscoveryJSON(w http.ResponseWriter, req *http.Request, value any) {
	body, err := json.Marshal(value)
	if err != nil {
		slog.Error("router: failed to marshal discovery", "error", err)
		http.Error(w, "failed to marshal discovery", http.StatusInternalServerError)
		return
	}
	serveCachedDoc(w, req, &cachedDoc{body: body, etag: quoteETag(hashHex(string(body)))})
}
