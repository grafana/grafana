package router

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
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

func (r *GrafanaRouter) serveAPIGroupList(w http.ResponseWriter, req *http.Request, next http.Handler) {
	w.Header().Set("Vary", "Accept")
	r.setRootDiscoveryCacheControl(w, next)
	mediaType, _ := negotiation.NegotiateMediaTypeOptions(req.Header.Get("Accept"), discoveryCodecs.SupportedMediaTypes(), aggregated.DiscoveryEndpointRestrictions)
	if aggregated.IsAggregatedDiscoveryGVK(mediaType.Convert) {
		r.serveAggregatedDiscovery(w, req, next)
		return
	}

	var fallback metav1.APIGroupList
	scoped, err := r.readRootDiscovery(req, next, apisPrefix, "application/json", &fallback)
	if err != nil || fallback.Kind != "APIGroupList" {
		serveCachedDoc(w, req, r.rootDocFor(w, req, &r.apiGroupList, &r.publicAPIGroupList))
		return
	}
	r.serveMergedAPIGroupList(w, req, fallback, scoped)
}

// serveMergedAPIGroupList serves the source's APIGroupList with the router's
// groups added. When scoped, the source's answer replaces the caller-scoped
// defaults. A group hidden from the caller keeps the source's answer, since
// its requests go to the source too.
func (r *GrafanaRouter) serveMergedAPIGroupList(w http.ResponseWriter, req *http.Request, fallback metav1.APIGroupList, scoped bool) {
	groups := make(map[string]metav1.APIGroup, len(fallback.Groups))
	for _, group := range fallback.Groups {
		groups[group.Name] = group
	}
	vis := r.visibilityFor(req)
	for name, entry := range *r.snapshot.Load() {
		// The source answered for this caller, so it replaces the defaults.
		if !vis.hides(entry) && (!entry.callerScoped || !scoped) {
			groups[name] = entry.group
		}
	}
	groups[discoveryGroup] = discoveryAPIGroup
	fallback.Groups = make([]metav1.APIGroup, 0, len(groups))
	for _, group := range groups {
		fallback.Groups = append(fallback.Groups, group)
	}
	sort.Slice(fallback.Groups, func(i, j int) bool { return fallback.Groups[i].Name < fallback.Groups[j].Name })
	vis.keepPrivate(w)
	serveDiscoveryJSON(w, req, fallback)
}

func (r *GrafanaRouter) serveAggregatedDiscovery(w http.ResponseWriter, req *http.Request, next http.Handler) {
	groups := map[string]apidiscoveryv2.APIGroupDiscovery{}
	var raw json.RawMessage
	var meta metav1.TypeMeta
	callerScoped, err := r.readRootDiscovery(req, next, apisPrefix, aggregatedDiscoveryJSON, &raw)
	if err == nil {
		_ = json.Unmarshal(raw, &meta) // anything undecodable has no Kind, and is ignored
	}
	scoped := false
	switch meta.Kind {
	case "APIGroupDiscoveryList":
		var fallback apidiscoveryv2.APIGroupDiscoveryList
		if json.Unmarshal(raw, &fallback) == nil {
			scoped = callerScoped
			for _, group := range fallback.Items {
				groups[group.Name] = group
			}
		}
	case "APIGroupList":
		// The caller's stack only serves legacy discovery. Answer in that format,
		// as kube-apiserver does, rather than with defaults that may not be the
		// caller's: the client then reads each group version itself.
		if callerScoped {
			r.serveLegacyInsteadOfAggregated(w, req, raw)
			return
		}
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
	vis := r.visibilityFor(req)
	for name, entry := range snapshot {
		// A group hidden from the caller keeps the fallback's answer, since
		// its requests go to the fallback too.
		if vis.hides(entry) || entry.callerScoped && scoped {
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
	if _, callerScoped := r.discoverySource(next); callerScoped || vis.restricted {
		w = &privateCacheWriter{ResponseWriter: w}
	}
	manager.ServeHTTP(w, req)
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
		serveThroughBreaker(entry.breaker, name, entry.handler, w, r)
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
		if status == http.StatusOK || status == http.StatusNotFound {
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

func (r *GrafanaRouter) serveOpenAPIIndex(w http.ResponseWriter, req *http.Request, next http.Handler) {
	r.setRootDiscoveryCacheControl(w, next)
	var fallback handler3.OpenAPIV3Discovery
	scoped, err := r.readRootDiscovery(req, next, openapiV3Prefix, "application/json", &fallback)
	if err != nil || fallback.Paths == nil {
		serveCachedDoc(w, req, r.rootDocFor(w, req, &r.openapiIndex, &r.publicOpenAPIIndex))
		return
	}
	handlers := *r.snapshot.Load()
	discoveryPath, discoveryURL := discoveryOpenAPIEntry()
	fallback.Paths[discoveryPath] = handler3.OpenAPIV3DiscoveryGroupVersion{ServerRelativeURL: discoveryURL}
	// A group hidden from the caller keeps the source's paths, since its
	// requests go to the source too.
	vis := r.visibilityFor(req)
	for path := range fallback.Paths {
		group, _, ok := parseOpenAPIGroupVersionPath(openapiV3Prefix + "/" + path)
		if entry, owned := handlers[group]; ok && owned && !vis.hides(entry) && (!entry.callerScoped || !scoped) {
			delete(fallback.Paths, path)
		}
	}
	for _, entry := range handlers {
		if vis.hides(entry) || entry.callerScoped && scoped {
			continue
		}
		for _, gv := range entry.group.Versions {
			path := "apis/" + gv.GroupVersion
			fallback.Paths[path] = handler3.OpenAPIV3DiscoveryGroupVersion{
				ServerRelativeURL: fmt.Sprintf("%s/%s?hash=%s", openapiV3Prefix, path, entry.key),
			}
		}
	}
	vis.keepPrivate(w)
	serveDiscoveryJSON(w, req, fallback)
}

// serveLegacyInsteadOfAggregated answers an aggregated discovery request with
// the source's legacy APIGroupList, if the client accepts plain JSON.
func (r *GrafanaRouter) serveLegacyInsteadOfAggregated(w http.ResponseWriter, req *http.Request, raw json.RawMessage) {
	var list metav1.APIGroupList
	if err := json.Unmarshal(raw, &list); err != nil {
		http.Error(w, "invalid discovery from the caller's stack", http.StatusBadGateway)
		return
	}
	mediaType, ok := negotiation.NegotiateMediaTypeOptions(req.Header.Get("Accept"), discoveryCodecs.SupportedMediaTypes(), negotiation.DefaultEndpointRestrictions)
	if !ok || mediaType.Accepted.MediaType != "application/json" {
		http.Error(w, "the caller's stack serves only legacy discovery", http.StatusNotAcceptable)
		return
	}
	r.serveMergedAPIGroupList(w, req, list, true)
}

// setRootDiscoveryCacheControl keeps root discovery out of shared caches when
// it depends on the caller: credentials may arrive in X-Access-Token, which a
// cache keyed on Authorization would not tell apart.
func (r *GrafanaRouter) setRootDiscoveryCacheControl(w http.ResponseWriter, next http.Handler) {
	if _, scoped := r.discoverySource(next); scoped {
		w.Header().Set("Cache-Control", "private")
	}
}

// readRootDiscovery reads root discovery from the source of unserved groups.
// scoped reports whether the answer replaces the caller-scoped defaults.
func (r *GrafanaRouter) readRootDiscovery(req *http.Request, next http.Handler, path, accept string, into any) (scoped bool, err error) {
	source, scoped := r.discoverySource(next)
	if scoped {
		// The fallback forwards to the caller's stack, and a slow stack must
		// not hold discovery open when the defaults are available.
		ctx, cancel := context.WithTimeout(req.Context(), discoveryFetchTimeout)
		defer cancel()
		req = req.WithContext(ctx)
	}
	_, err = readDiscovery(req, source, path, accept, into)
	return scoped, err
}

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
