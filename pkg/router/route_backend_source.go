package router

import (
	"cmp"
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"slices"
	"time"

	"golang.org/x/sync/errgroup"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
)

// routeBackendSource serves the groups configured by RouteBackend and
// AppManifest CRs on the remote control-plane apiserver. Its informers wake
// the router, and once synced their caches replace listing the CRs on every
// load.
type routeBackendSource struct {
	dirty                      chan<- struct{}
	routeBackendClient         *v1alpha2.RouteBackendClient
	appManifestClient          *v1alpha2.AppManifestClient
	transports                 map[tlsCacheKey]*http.Transport
	dialer                     *transport.DialHolder
	coreGroupsWithoutManifests map[string]metav1.APIGroup

	rbInformer *operator.KubernetesBasedInformer
	amInformer *operator.KubernetesBasedInformer

	status pollStatus
}

var _ routeSource = (*routeBackendSource)(nil)

func newRouteBackendSource(clients *k8s.ClientRegistry, dirty chan<- struct{}) (*routeBackendSource, error) {
	s := &routeBackendSource{
		dirty:                      dirty,
		transports:                 map[tlsCacheKey]*http.Transport{},
		coreGroupsWithoutManifests: getAPIGroupsForCoreGroupsWithoutManifests(),
	}
	var err error
	if s.routeBackendClient, err = v1alpha2.NewRouteBackendClientFromGenerator(clients); err != nil {
		return nil, err
	}
	if s.appManifestClient, err = v1alpha2.NewAppManifestClientFromGenerator(clients); err != nil {
		return nil, err
	}

	// Built here, not when the service starts, because backends reads these
	// fields from the reconcile goroutine. Construction makes no requests.
	watcher := s.Watcher()
	if s.rbInformer, err = newInformer(v1alpha2.RouteBackendKind(), clients, watcher); err != nil {
		return nil, fmt.Errorf("route backend informer: %w", err)
	}
	if s.amInformer, err = newInformer(v1alpha2.AppManifestKind(), clients, watcher); err != nil {
		return nil, fmt.Errorf("app manifest informer: %w", err)
	}
	// Once synced, backends reads the caches, so the source's health comes
	// from the informers themselves: their list and watch errors, and (in
	// Watcher) the events they receive.
	for _, inf := range []*operator.KubernetesBasedInformer{s.rbInformer, s.amInformer} {
		if err := inf.SharedIndexInformer.SetWatchErrorHandlerWithContext(func(ctx context.Context, r *cache.Reflector, err error) {
			s.status.recordFailure()
			cache.DefaultWatchErrorHandler(ctx, r, err)
		}); err != nil {
			return nil, fmt.Errorf("informer watch error handler: %w", err)
		}
	}
	return s, nil
}

// backends returns a backend for each RouteBackend with a manifest. Until the
// informers sync it lists the CRs, and a failed list fails the whole load:
// the source has no last-known-good routes of its own.
func (s *routeBackendSource) backends(ctx context.Context) ([]Backend, error) {
	manifests, backends, err := s.routeResources(ctx)
	if err != nil {
		return nil, err
	}
	return s.combineByName(ctx, manifests, backends), nil
}

// run drives the informers until ctx is done.
func (s *routeBackendSource) run(ctx context.Context) error {
	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error { return s.rbInformer.Run(gctx) })
	g.Go(func() error { return s.amInformer.Run(gctx) })
	return g.Wait()
}

func (s *routeBackendSource) sourceStatus() sourceStatus {
	return s.status.status(sourceRouteBackend)
}

// embeddedManifestKey is the key component used for API groups sourced from
// getAPIGroupsForCoreGroupsWithoutManifests rather than an AppManifest CR.
// It has no ResourceVersion to track, so a constant marks it as "changes only
// on redeploy" for the fingerprint in combineByName.
const embeddedManifestKey = "embedded"

type tlsCacheKey struct {
	caData   string
	insecure bool
}

type apiGroupWithKey struct {
	group metav1.APIGroup
	key   string
}

// newInformer builds a kind's informer against clients, with watcher as its
// only event handler.
func newInformer(kind resource.Kind, clients *k8s.ClientRegistry, watcher operator.ResourceWatcher) (*operator.KubernetesBasedInformer, error) {
	client, err := clients.ClientFor(kind)
	if err != nil {
		return nil, err
	}
	inf, err := operator.NewKubernetesBasedInformer(kind, client, operator.InformerOptions{})
	if err != nil {
		return nil, err
	}
	if err := inf.AddEventHandler(watcher); err != nil {
		return nil, err
	}
	return inf, nil
}

func (s *routeBackendSource) Watcher() operator.ResourceWatcher {
	// The event carries no data we use: reconcile re-reads full state via Load.
	// So push is a pure edge, coalesced against the buffered-1 dirty channel.
	push := func() {
		// An event means data arrived from the remote apiserver.
		s.status.recordSuccess(time.Now())
		select {
		case s.dirty <- struct{}{}:
		default: // a wake is already pending; drop this redundant signal
		}
	}
	return &operator.SimpleWatcher{
		AddFunc:    func(_ context.Context, _ resource.Object) error { push(); return nil },
		UpdateFunc: func(_ context.Context, _, _ resource.Object) error { push(); return nil },
		DeleteFunc: func(_ context.Context, _ resource.Object) error { push(); return nil },
	}
}

// routeResources returns the AppManifests and RouteBackends from the informer
// caches once both have synced. Before then it lists them from the remote
// apiserver, so the first reconciles are correct without waiting for a sync.
func (s *routeBackendSource) routeResources(ctx context.Context) ([]v1alpha2.AppManifest, []v1alpha2.RouteBackend, error) {
	if s.rbInformer != nil && s.amInformer != nil &&
		s.rbInformer.SharedIndexInformer.HasSynced() && s.amInformer.SharedIndexInformer.HasSynced() {
		manifests, err := cachedItems[v1alpha2.AppManifest](s.amInformer, v1alpha2.AppManifestKind())
		if err != nil {
			return nil, nil, err
		}
		backends, err := cachedItems[v1alpha2.RouteBackend](s.rbInformer, v1alpha2.RouteBackendKind())
		if err != nil {
			return nil, nil, err
		}
		return manifests, backends, nil
	}

	// Only a direct list counts toward the source's status; cache reads say
	// nothing about the remote apiserver.
	backends, err := s.routeBackendClient.ListAll(ctx, "", resource.ListOptions{})
	if err != nil {
		s.status.recordFailure()
		return nil, nil, err
	}
	manifests, err := s.appManifestClient.ListAll(ctx, "", resource.ListOptions{})
	if err != nil {
		s.status.recordFailure()
		return nil, nil, err
	}
	s.status.recordSuccess(time.Now())
	return manifests.Items, backends.Items, nil
}

// cachedItems copies an informer's cached objects, sorted by name so that
// combineByName resolves duplicates the same way a List would. Objects from
// the initial list are typed, but those from the watch are untyped wrappers,
// so they are decoded the same way the SDK decodes informer events.
func cachedItems[T any, PT interface {
	*T
	resource.Object
}](inf *operator.KubernetesBasedInformer, kind resource.Kind) ([]T, error) {
	objs := inf.SharedIndexInformer.GetStore().List()
	items := make([]PT, 0, len(objs))
	for _, obj := range objs {
		item, err := typedObject[PT](obj, kind)
		if err != nil {
			return nil, fmt.Errorf("%s informer cache: %w", kind.Kind(), err)
		}
		items = append(items, item)
	}
	slices.SortFunc(items, func(a, b PT) int {
		return cmp.Or(cmp.Compare(a.GetNamespace(), b.GetNamespace()), cmp.Compare(a.GetName(), b.GetName()))
	})
	out := make([]T, len(items))
	for i, item := range items {
		out[i] = *item
	}
	return out, nil
}

func typedObject[PT resource.Object](obj any, kind resource.Kind) (PT, error) {
	var zero PT
	if w, ok := obj.(operator.ResourceObjectWrapper); ok {
		obj = w.ResourceObject()
	}
	if c, ok := obj.(operator.ConvertableIntoResourceObject); ok {
		into := kind.ZeroValue()
		if err := c.Into(into, kind.Codec(resource.KindEncodingJSON)); err != nil {
			return zero, err
		}
		obj = into
	}
	typed, ok := obj.(PT)
	if !ok {
		return zero, fmt.Errorf("unexpected %T", obj)
	}
	return typed, nil
}

// transportFor returns the cached transport for the given TLS settings. The
// cache is what keeps connection pools alive when a group is rebuilt. Only
// reconcile calls it, so the map needs no lock.
func (s *routeBackendSource) transportFor(key tlsCacheKey) (*http.Transport, error) {
	if t, ok := s.transports[key]; ok {
		return t, nil
	}

	// nosemgrep: problem-based-packs.insecure-transport.go-stdlib.bypass-tls-verification.bypass-tls-verification
	tlsCfg := &tls.Config{MinVersion: tls.VersionTLS12}
	switch {
	case key.insecure:
		// Driven by the RouteBackend spec's Tls.SkipTLSVerify. Intentional
		// dual-use: some backends are reached over trusted internal links
		// without a verifiable cert. Only enable for backends whose link is
		// actually trusted — this disables cert verification (MITM exposure).
		tlsCfg.InsecureSkipVerify = true // #nosec G402 -- spec-gated, trusted-link only
	case key.caData != "":
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM([]byte(key.caData)) {
			return nil, fmt.Errorf("invalid CA PEM data")
		}
		tlsCfg.RootCAs = pool
	}

	t := http.DefaultTransport.(*http.Transport).Clone()
	t.TLSClientConfig = tlsCfg
	t.ResponseHeaderTimeout = backendResponseHeaderTimeout
	if s.dialer != nil {
		t.DialContext = s.dialer.Dial
	}

	s.transports[key] = t
	return t, nil
}

// retainTransports drops the cached transports that no current route
// backend uses. A retired backend may still be finishing requests on one, so
// only its idle connections are closed.
func (s *routeBackendSource) retainTransports(used map[tlsCacheKey]struct{}) {
	for key, t := range s.transports {
		if _, ok := used[key]; !ok {
			t.CloseIdleConnections()
			delete(s.transports, key)
		}
	}
}

func (s *routeBackendSource) combineByName(ctx context.Context, manifests []v1alpha2.AppManifest, backends []v1alpha2.RouteBackend) []Backend {
	// Index the manifests by AppName, we can then correlate them with backends found and combine for RouteConfig
	manifestMap := make(map[string]apiGroupWithKey, len(manifests))
	for _, m := range manifests {
		manifestMap[m.Spec.AppName] = apiGroupWithKey{
			group: apiGroupFromManifestSpec(m.Spec),
			key:   m.ResourceVersion,
		}
	}

	// 2. Iterate the second slice and correlate
	var combined []Backend
	usedTransports := map[tlsCacheKey]struct{}{}
	defer s.retainTransports(usedTransports)
	for _, b := range backends {
		m, ok := manifestMap[b.Name]
		if !ok {
			if group, found := s.coreGroupsWithoutManifests[b.Name]; found {
				m, ok = apiGroupWithKey{group: group, key: embeddedManifestKey}, true
			}
		}
		if ok {
			// Operator/Plugin backends, and any Forward backend missing its
			// config block, have a nil Forward -- not yet supported here.
			if b.Spec.Forward == nil {
				logging.FromContext(ctx).Warn("router.NewForwardBackend: route backend has no forward config, skipping", "Group", m.group.Name, "mode", b.Spec.Mode)
				continue
			}
			transportKey := tlsCacheKey{
				insecure: b.Spec.Forward.Tls.SkipTLSVerify,
			}
			if b.Spec.Forward.Tls.CaData != nil {
				transportKey.caData = *b.Spec.Forward.Tls.CaData
			}

			transport, err := s.transportFor(transportKey)
			if err != nil {
				logging.FromContext(ctx).Warn("router.NewForwardBackend failed to create or fetch cached transport", "Group", m.group.Name, "err", err)
				continue
			}
			usedTransports[transportKey] = struct{}{}
			current, err := NewForwardBackend(m.group, b.Spec, b.ResourceVersion+"-"+m.key, transport)
			if err != nil {
				logging.FromContext(ctx).Warn("router.NewForwardBackend failed", "Group", m.group.Name, "err", err)
				continue
			}
			combined = append(combined, current)
		} else {
			logging.FromContext(ctx).Warn("RoutesLoader: manifest not found for route backend", "name", b.Name)
			continue
		}
	}
	return combined
}
