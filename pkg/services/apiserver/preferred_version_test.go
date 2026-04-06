package apiserver

import (
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	serverstorage "k8s.io/apiserver/pkg/server/storage"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestParseGroupVersionSetting(t *testing.T) {
	gv, err := ParseGroupVersionSetting("dashboard.grafana.app/v1")
	require.NoError(t, err)
	require.Equal(t, "dashboard.grafana.app", gv.Group)
	require.Equal(t, "v1", gv.Version)

	_, err = ParseGroupVersionSetting("novslash")
	require.Error(t, err)

	_, err = ParseGroupVersionSetting("/v1")
	require.Error(t, err)
}

func TestApplyPreferredForGroup_ReordersVersions(t *testing.T) {
	scheme := runtime.NewScheme()
	gvAlpha := schema.GroupVersion{Group: "test.example", Version: "v1alpha1"}
	gvStable := schema.GroupVersion{Group: "test.example", Version: "v1"}
	metav1.AddToGroupVersion(scheme, gvAlpha)
	metav1.AddToGroupVersion(scheme, gvStable)
	require.NoError(t, scheme.SetVersionPriority(gvAlpha, gvStable))

	rc := serverstorage.NewResourceConfig()
	rc.EnableVersions(gvAlpha, gvStable)

	require.NoError(t, ApplyPreferredForGroup(log.NewNopLogger(), scheme, rc, gvStable))

	pvs := scheme.PrioritizedVersionsForGroup("test.example")
	require.Len(t, pvs, 2)
	require.Equal(t, "v1", pvs[0].Version)
	require.Equal(t, "v1alpha1", pvs[1].Version)
}

func TestApplyPreferredForGroup_SkipsWhenDisabled(t *testing.T) {
	scheme := runtime.NewScheme()
	gvAlpha := schema.GroupVersion{Group: "test.example", Version: "v1alpha1"}
	gvStable := schema.GroupVersion{Group: "test.example", Version: "v1"}
	metav1.AddToGroupVersion(scheme, gvAlpha)
	metav1.AddToGroupVersion(scheme, gvStable)
	require.NoError(t, scheme.SetVersionPriority(gvAlpha, gvStable))

	rc := serverstorage.NewResourceConfig()
	rc.EnableVersions(gvAlpha)
	rc.DisableVersions(gvStable)

	require.NoError(t, ApplyPreferredForGroup(log.NewNopLogger(), scheme, rc, gvStable))

	pvs := scheme.PrioritizedVersionsForGroup("test.example")
	require.Len(t, pvs, 2)
	require.Equal(t, "v1alpha1", pvs[0].Version, "unchanged order when preferred is disabled")
}

func TestReorderGroupVersionsForLegacyCodec_PutsPreferredFirstInGroup(t *testing.T) {
	cfg := setting.NewCfg()
	sec := cfg.Raw.Section("grafana-apiserver")
	_, err := sec.NewKey("preferred_api_version", "test.example/v1")
	require.NoError(t, err)

	scheme := runtime.NewScheme()
	gvAlpha := schema.GroupVersion{Group: "test.example", Version: "v1alpha1"}
	gvStable := schema.GroupVersion{Group: "test.example", Version: "v1"}
	metav1.AddToGroupVersion(scheme, gvAlpha)
	metav1.AddToGroupVersion(scheme, gvStable)
	require.NoError(t, scheme.SetVersionPriority(gvAlpha, gvStable))

	other := schema.GroupVersion{Group: "other.example", Version: "v1"}
	metav1.AddToGroupVersion(scheme, other)

	input := []schema.GroupVersion{
		other,
		gvAlpha,
		gvStable,
	}
	out, err := ReorderGroupVersionsForLegacyCodec(log.NewNopLogger(), cfg, scheme, input)
	require.NoError(t, err)
	require.Equal(t, []schema.GroupVersion{other, gvStable, gvAlpha}, out)
}

func TestReorderGroupVersionsForLegacyCodec_EmptySettingNoop(t *testing.T) {
	cfg := setting.NewCfg()
	scheme := runtime.NewScheme()
	gv := schema.GroupVersion{Group: "test.example", Version: "v1"}
	metav1.AddToGroupVersion(scheme, gv)
	input := []schema.GroupVersion{gv}
	out, err := ReorderGroupVersionsForLegacyCodec(log.NewNopLogger(), cfg, scheme, input)
	require.NoError(t, err)
	require.Equal(t, input, out)
}

func TestReorderGroupVersionsForLegacyCodec_InvalidEntry(t *testing.T) {
	cfg := setting.NewCfg()
	sec := cfg.Raw.Section("grafana-apiserver")
	_, err := sec.NewKey("preferred_api_version", "not-a-valid-gv")
	require.NoError(t, err)

	scheme := runtime.NewScheme()
	_, err = ReorderGroupVersionsForLegacyCodec(log.NewNopLogger(), cfg, scheme, nil)
	require.Error(t, err)
}
