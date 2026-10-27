package router

import (
	"context"
	"crypto/sha512"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"sort"
	"strings"
	"sync"

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

	"github.com/grafana/grafana-app-sdk/logging"
)

const aggregatedDiscoveryJSON = "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList"

var discoveryCodecs = func() serializer.CodecFactory {
	scheme := runtime.NewScheme()
	utilruntime.Must(apidiscoveryv2.AddToScheme(scheme))
	utilruntime.Must(apidiscoveryv2beta1.AddToScheme(scheme))
	return serializer.NewCodecFactory(scheme)
}()

func (r *GrafanaRouter) serveAPIGroupList(w http.ResponseWriter, req *http.Request) {
	w.Header().Set("Vary", "Accept")
	r.setRootDiscoveryCacheControl(w)
	mediaType, _ := negotiation.NegotiateMediaTypeOptions(req.Header.Get("Accept"), discoveryCodecs.SupportedMediaTypes(), aggregated.DiscoveryEndpointRestrictions)
	if aggregated.IsAggregatedDiscoveryGVK(mediaType.Convert) {
		r.serveAggregatedDiscovery(w, req)
		return
	}

	var fallback metav1.APIGroupList
	if err := r.readRootDiscovery(req, apisPrefix, "application/json", &fallback); err != nil || fallback.Kind != "APIGroupList" {
		serveCachedDoc(w, req, r.apiGroupList.Load())
		return
	}
	r.serveMergedAPIGroupList(w, req, fallback)
}

// serveMergedAPIGroupList serves the source's APIGroupList with the router's
// groups added. The source answers for the caller, so its answer replaces the
// caller-scoped defaults.
func (r *GrafanaRouter) serveMergedAPIGroupList(w http.ResponseWriter, req *http.Request, fallback metav1.APIGroupList) {
	groups := make(map[string]metav1.APIGroup, len(fallback.Groups))
	for _, group := range fallback.Groups {
		groups[group.Name] = group
	}
	for name, entry := range *r.snapshot.Load() {
		if !entry.callerScoped {
			groups[name] = entry.group
		}
	}
	groups[discoveryGroup] = discoveryAPIGroup
	fallback.Groups = make([]metav1.APIGroup, 0, len(groups))
	for _, group := range groups {
		fallback.Groups = append(fallback.Groups, group)
	}
	sort.Slice(fallback.Groups, func(i, j int) bool { return fallback.Groups[i].Name < fallback.Groups[j].Name })
	serveDiscoveryJSON(w, req, fallback)
}

func (r *GrafanaRouter) serveAggregatedDiscovery(w http.ResponseWriter, req *http.Request) {
	groups := map[string]apidiscoveryv2.APIGroupDiscovery{}
	var raw json.RawMessage
	var fallback apidiscoveryv2.APIGroupDiscoveryList
	err := r.readRootDiscovery(req, apisPrefix, aggregatedDiscoveryJSON, &raw)
	if err == nil && json.Unmarshal(raw, &fallback) != nil {
		fallback = apidiscoveryv2.APIGroupDiscoveryList{} // anything undecodable has no Kind, and is ignored
	}
	// scoped is set when the source answered for the caller, whose view then
	// replaces the caller-scoped defaults.
	scoped := false
	switch fallback.Kind {
	case "APIGroupDiscoveryList":
		scoped = true
		for _, group := range fallback.Items {
			groups[group.Name] = group
		}
	case "APIGroupList":
		// The source has only legacy discovery for the caller. Answer in that
		// format, as kube-apiserver does, rather than with defaults that may
		// not be the caller's: the client then reads each group version itself.
		r.serveLegacyInsteadOfAggregated(w, req, raw)
		return
	}
	// A backend owns the entire group, including which versions are served.
	// Never keep fallback versions of a group the router has taken over.
	// Fetches run in parallel, each writing only its own result slot, and the
	// groups map is written on this goroutine alone.
	type fetch struct {
		name   string
		result apidiscoveryv2.APIGroupDiscovery
	}
	snapshot := *r.snapshot.Load()
	fetches := make([]*fetch, 0, len(snapshot))
	var wg sync.WaitGroup
	for name, entry := range snapshot {
		if entry.callerScoped && scoped {
			continue
		}
		if entry.discovery != nil {
			groups[name] = *entry.discovery
			r.observeDiscovery(name, discoveryProvided)
			continue
		}
		if entry.callerScoped {
			// The discovery cache is shared, so it must not hold one caller's view.
			groups[name] = unavailableDiscovery(name, entry)
			r.observeDiscovery(name, discoveryUnavailable)
			continue
		}
		f := &fetch{name: name}
		fetches = append(fetches, f)
		wg.Add(1)
		go func() {
			defer wg.Done()
			f.result = r.groupDiscovery(req, name, entry)
		}()
	}
	wg.Wait()
	for _, f := range fetches {
		groups[f.name] = f.result
	}
	groups[discoveryGroup] = discoveryAggregated
	if r.unregisteredGroupHandler != nil {
		w = &privateCacheWriter{ResponseWriter: w}
	}
	writeAggregatedDiscovery(w, req, groups)
}

// writeAggregatedDiscovery serves groups as the apiserver's aggregated
// discovery manager would, with the same order and ETag, but without building
// one per request: that logs a line for every group version, every time.
//
// Every group has the same priority, so groups are sorted by name, and each
// keeps its versions in order. A group without versions isn't listed, and
// only a group's name and versions are kept.
func writeAggregatedDiscovery(w http.ResponseWriter, req *http.Request, groups map[string]apidiscoveryv2.APIGroupDiscovery) {
	list := &apidiscoveryv2.APIGroupDiscoveryList{Items: make([]apidiscoveryv2.APIGroupDiscovery, 0, len(groups))}
	for _, group := range groups {
		if len(group.Versions) > 0 {
			list.Items = append(list.Items, apidiscoveryv2.APIGroupDiscovery{
				ObjectMeta: metav1.ObjectMeta{Name: group.Name},
				Versions:   group.Versions,
			})
		}
	}
	slices.SortFunc(list.Items, func(a, b apidiscoveryv2.APIGroupDiscovery) int { return strings.Compare(a.Name, b.Name) })
	body, err := json.Marshal(list)
	if err != nil {
		http.Error(w, "encoding discovery: "+err.Error(), http.StatusInternalServerError)
		return
	}
	// Only v2 reaches here: serveAPIGroupList answers anything else in the
	// legacy format.
	aggregated.ServeHTTPWithETag(list, fmt.Sprintf("%X", sha512.Sum512(body)), apidiscoveryv2.SchemeGroupVersion, discoveryCodecs, w, req)
}

// privateCacheWriter replaces the Cache-Control: public that the aggregated
// discovery handler always sets, for a response that depends on the caller.
type privateCacheWriter struct {
	http.ResponseWriter
	wroteHeader bool
}

func (p *privateCacheWriter) WriteHeader(code int) {
	if !p.wroteHeader {
		p.wroteHeader = true
		p.Header().Set("Cache-Control", "private")
	}
	p.ResponseWriter.WriteHeader(code)
}

func (p *privateCacheWriter) Write(b []byte) (int, error) {
	if !p.wroteHeader {
		p.WriteHeader(http.StatusOK)
	}
	return p.ResponseWriter.Write(b)
}

// backendDiscovery asks a backend for its group's aggregated discovery.
// complete is false when any version could not be read and is marked stale.
func backendDiscovery(req *http.Request, name string, entry servingEntry) (_ apidiscoveryv2.APIGroupDiscovery, complete bool) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		entry.serve(name, w, r)
	})
	var list apidiscoveryv2.APIGroupDiscoveryList
	status, err := readDiscovery(req, handler, apisPrefix, aggregatedDiscoveryJSON, &list)
	if err == nil && list.Kind == "APIGroupDiscoveryList" {
		for _, group := range list.Items {
			if group.Name == name {
				return group, true
			}
		}
	}

	group := apidiscoveryv2.APIGroupDiscovery{ObjectMeta: metav1.ObjectMeta{Name: name}}
	// Only a real answer from /apis can be complete: a decoded document, or a
	// 404 from an older backend. Otherwise a group with no versions would be
	// cached empty after a failed or refused fetch.
	complete = err == nil || status == http.StatusNotFound
	for _, gv := range entry.group.Versions {
		version := apidiscoveryv2.APIVersionDiscovery{Version: gv.Version, Freshness: apidiscoveryv2.DiscoveryFreshnessStale}
		// Older backends may only support per-version resource discovery. An
		// unavailable backend stays advertised as stale without hiding healthy groups.
		// Once the fetch's deadline has passed, the rest are not read: each
		// read would fail at once and count against the breaker again.
		if (status == http.StatusOK || status == http.StatusNotFound) && req.Context().Err() == nil {
			var resources metav1.APIResourceList
			if _, err := readDiscovery(req, handler, apisPrefix+"/"+gv.GroupVersion, "application/json", &resources); err == nil && resources.Kind == "APIResourceList" {
				if converted, err := endpoints.ConvertGroupVersionIntoToDiscovery(resources.APIResources); err == nil {
					version.Resources = converted
					version.Freshness = apidiscoveryv2.DiscoveryFreshnessCurrent
				}
			}
		}
		complete = complete && version.Freshness == apidiscoveryv2.DiscoveryFreshnessCurrent
		group.Versions = append(group.Versions, version)
	}
	return group, complete
}

func (r *GrafanaRouter) serveOpenAPIIndex(w http.ResponseWriter, req *http.Request) {
	r.setRootDiscoveryCacheControl(w)
	var fallback handler3.OpenAPIV3Discovery
	if err := r.readRootDiscovery(req, openapiV3Prefix, "application/json", &fallback); err != nil || fallback.Paths == nil {
		serveCachedDoc(w, req, r.openapiIndex.Load())
		return
	}
	handlers := *r.snapshot.Load()
	discoveryPath, discoveryURL := discoveryOpenAPIEntry()
	fallback.Paths[discoveryPath] = handler3.OpenAPIV3DiscoveryGroupVersion{ServerRelativeURL: discoveryURL}
	for path := range fallback.Paths {
		group, _, ok := parseOpenAPIGroupVersionPath(openapiV3Prefix + "/" + path)
		// The source answers for the caller, so its view of a caller-scoped
		// group replaces the router's default.
		if entry, owned := handlers[group]; ok && owned && !entry.callerScoped {
			delete(fallback.Paths, path)
		}
	}
	for _, entry := range handlers {
		if entry.callerScoped {
			continue
		}
		for _, gv := range entry.group.Versions {
			path := "apis/" + gv.GroupVersion
			fallback.Paths[path] = handler3.OpenAPIV3DiscoveryGroupVersion{
				ServerRelativeURL: fmt.Sprintf("%s/%s?hash=%s", openapiV3Prefix, path, entry.key),
			}
		}
	}
	serveDiscoveryJSON(w, req, fallback)
}

// serveLegacyInsteadOfAggregated answers an aggregated discovery request with
// the source's legacy APIGroupList, if the client accepts plain JSON.
func (r *GrafanaRouter) serveLegacyInsteadOfAggregated(w http.ResponseWriter, req *http.Request, raw json.RawMessage) {
	var list metav1.APIGroupList
	if err := json.Unmarshal(raw, &list); err != nil {
		http.Error(w, "invalid discovery for the caller", http.StatusBadGateway)
		return
	}
	mediaType, ok := negotiation.NegotiateMediaTypeOptions(req.Header.Get("Accept"), discoveryCodecs.SupportedMediaTypes(), negotiation.DefaultEndpointRestrictions)
	if !ok || mediaType.Accepted.MediaType != "application/json" {
		http.Error(w, "only legacy discovery is served for the caller", http.StatusNotAcceptable)
		return
	}
	r.serveMergedAPIGroupList(w, req, list)
}

// setRootDiscoveryCacheControl keeps root discovery out of shared caches when
// it depends on the caller: credentials may arrive in X-Access-Token, which a
// cache keyed on Authorization would not tell apart.
func (r *GrafanaRouter) setRootDiscoveryCacheControl(w http.ResponseWriter) {
	if r.unregisteredGroupHandler != nil {
		w.Header().Set("Cache-Control", "private")
	}
}

// readRootDiscovery reads root discovery from the unregistered-group handler,
// which answers for the caller. It fails when there is none, and root
// discovery lists only the router's groups.
func (r *GrafanaRouter) readRootDiscovery(req *http.Request, path, accept string, into any) error {
	source := r.unregisteredGroupHandler
	if source == nil {
		return errNoDiscoverySource
	}
	// The source may ask another server for the caller, and a slow one must
	// not hold discovery open when the defaults are available.
	ctx, cancel := context.WithTimeoutCause(req.Context(), discoveryFetchTimeout, errRouterDeadline)
	defer cancel()
	_, err := readDiscovery(req.WithContext(ctx), source, path, accept, into)
	return err
}

var errNoDiscoverySource = errors.New("no source for groups the router does not serve")

func readDiscovery(req *http.Request, handler http.Handler, path, accept string, into any) (int, error) {
	proxyReq := req.Clone(withoutRequestOutcome(req.Context()))
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
	rec := newCaptureWriter(maxDiscoveryDocBytes, nil)
	handler.ServeHTTP(rec, proxyReq)
	if rec.overflowed {
		return rec.statusCode, fmt.Errorf("discovery %s is larger than %d bytes", path, maxDiscoveryDocBytes)
	}
	if rec.statusCode != http.StatusOK {
		return rec.statusCode, fmt.Errorf("discovery %s returned HTTP %d", path, rec.statusCode)
	}
	return rec.statusCode, json.Unmarshal(rec.body.Bytes(), into)
}

func serveDiscoveryJSON(w http.ResponseWriter, req *http.Request, value any) {
	body, err := json.Marshal(value)
	if err != nil {
		logging.FromContext(req.Context()).Error("router: failed to marshal discovery", "error", err)
		http.Error(w, "failed to marshal discovery", http.StatusInternalServerError)
		return
	}
	serveCachedDoc(w, req, &cachedDoc{body: body, etag: quoteETag(hashHex(string(body)))})
}
