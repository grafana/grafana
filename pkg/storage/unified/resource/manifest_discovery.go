package resource

import (
	"context"

	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
)

// ManifestDiscovery reads the AppManifests the router publishes under
// /apis/discovery/v1alpha2/manifests, without going through HTTP. The router
// implements it; it is defined here so storage can depend on it without
// importing the router, which imports storage.
type ManifestDiscovery interface {
	// ListManifests returns every published manifest, ordered by group.
	ListManifests(ctx context.Context) (*appmanifestv1alpha2.AppManifestList, error)
	// GetManifest returns the manifest of one group, or a NotFound error.
	GetManifest(ctx context.Context, group string) (*appmanifestv1alpha2.AppManifest, error)
}
