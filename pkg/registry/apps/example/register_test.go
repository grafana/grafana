package example

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	examplev1alpha1 "github.com/grafana/grafana/apps/example/pkg/apis/example/v1alpha1"
	exampleapp "github.com/grafana/grafana/apps/example/pkg/app"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Out-of-tree callers construct the installer with these two arguments, so widening this signature breaks their
// build. Take new dependencies through ProvideAppInstaller instead.
func TestRegisterAppInstaller(t *testing.T) {
	installer, err := RegisterAppInstaller(setting.NewCfg(), featuremgmt.WithFeatures())
	require.NoError(t, err)
	require.NotNil(t, installer)
}

// The publisher announces an allowlist of exact strings, so it has to carry every finalizer the app declares as
// announced — otherwise the app runs an identity payload against metadata that never arrives.
func TestWatchMetadataCoversTheAppsFinalizers(t *testing.T) {
	spec, ok := resource.WatchMetadataFor(schema.GroupResource{Group: examplev1alpha1.APIGroup, Resource: "examples"})
	require.True(t, ok, "the example resource registers no watch metadata")
	require.ElementsMatch(t, exampleapp.AnnouncedFinalizers, spec.Finalizers)
}

// Announcing is the publisher's decision, so the app is told what this deployment sends rather than assuming the
// registration above reached the wire.
func TestBusAnnouncesMetadataFollowsTheSetting(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.NATS.NotificationMetadata = true
	installer, err := ProvideAppInstaller(cfg, featuremgmt.WithFeatures(), nil, nil)
	require.NoError(t, err)
	require.NotNil(t, installer)
}
