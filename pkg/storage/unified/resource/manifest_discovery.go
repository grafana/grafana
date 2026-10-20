package resource

import (
	"context"

	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
)

// ManifestDiscovery reads the AppManifests the router publishes under
// /apis/discovery/v1alpha2/manifests, without going through HTTP.
type ManifestDiscovery interface {
	// List returns every published manifest, ordered by group.
	List(ctx context.Context) (*appmanifestv1alpha2.AppManifestList, error)
	// Get returns the manifest of one group, or a NotFound error.
	Get(ctx context.Context, group string) (*appmanifestv1alpha2.AppManifest, error)
}

// EventualManifestDiscovery is a ManifestDiscovery supplied after construction
// via Set. It breaks the wiring cycle between storage, which reads manifests,
// and the router, which publishes them but depends on the resource client.
// Calls block until Set is called (or the context is cancelled).
type EventualManifestDiscovery struct {
	ready     chan struct{}
	discovery ManifestDiscovery
}

func ProvideEventualManifestDiscovery() *EventualManifestDiscovery {
	return &EventualManifestDiscovery{ready: make(chan struct{})}
}

// Set supplies the underlying discovery and unblocks pending and future calls.
// It must be called exactly once.
func (e *EventualManifestDiscovery) Set(discovery ManifestDiscovery) {
	e.discovery = discovery
	close(e.ready)
}

func (e *EventualManifestDiscovery) List(ctx context.Context) (*appmanifestv1alpha2.AppManifestList, error) {
	select {
	case <-e.ready:
		return e.discovery.List(ctx)
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (e *EventualManifestDiscovery) Get(ctx context.Context, group string) (*appmanifestv1alpha2.AppManifest, error) {
	select {
	case <-e.ready:
		return e.discovery.Get(ctx, group)
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}
