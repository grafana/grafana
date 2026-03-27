package apiserver

import (
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	serverstorage "k8s.io/apiserver/pkg/server/storage"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestParseGroupVersionSetting(t *testing.T) {
	gv, err := parseGroupVersionSetting("dashboard.grafana.app/v1")
	require.NoError(t, err)
	require.Equal(t, "dashboard.grafana.app", gv.Group)
	require.Equal(t, "v1", gv.Version)

	_, err = parseGroupVersionSetting("novslash")
	require.Error(t, err)

	_, err = parseGroupVersionSetting("/v1")
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

	require.NoError(t, applyPreferredForGroup(log.NewNopLogger(), scheme, rc, gvStable))

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

	require.NoError(t, applyPreferredForGroup(log.NewNopLogger(), scheme, rc, gvStable))

	pvs := scheme.PrioritizedVersionsForGroup("test.example")
	require.Len(t, pvs, 2)
	require.Equal(t, "v1alpha1", pvs[0].Version, "unchanged order when preferred is disabled")
}
