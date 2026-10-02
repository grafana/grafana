package router

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestParseStaticGroups_NoneConfigured(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{})
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	groups, err := parseStaticGroups(section)
	require.NoError(t, err)
	require.Empty(t, groups)
}

func TestParseStaticGroups_ValidMultiEntry(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"static_groups": `[
			{"name":"grafana-setupguide-app","group":"grafana-setupguide-app.ext.grafana.app","versions":["v0alpha1"],"preferredVersion":"v0alpha1"},
			{"name":"k6-app","group":"k6.ext.grafana.app","versions":["v0alpha1","v1alpha1"],"preferredVersion":"v1alpha1"}
		]`,
	})
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	groups, err := parseStaticGroups(section)
	require.NoError(t, err)
	require.Len(t, groups, 2)

	require.Equal(t, metav1.APIGroup{
		Name: "grafana-setupguide-app.ext.grafana.app",
		Versions: []metav1.GroupVersionForDiscovery{
			{GroupVersion: "grafana-setupguide-app.ext.grafana.app/v0alpha1", Version: "v0alpha1"},
		},
		PreferredVersion: metav1.GroupVersionForDiscovery{
			GroupVersion: "grafana-setupguide-app.ext.grafana.app/v0alpha1", Version: "v0alpha1",
		},
	}, groups["grafana-setupguide-app"])

	require.Equal(t, metav1.APIGroup{
		Name: "k6.ext.grafana.app",
		Versions: []metav1.GroupVersionForDiscovery{
			{GroupVersion: "k6.ext.grafana.app/v0alpha1", Version: "v0alpha1"},
			{GroupVersion: "k6.ext.grafana.app/v1alpha1", Version: "v1alpha1"},
		},
		PreferredVersion: metav1.GroupVersionForDiscovery{
			GroupVersion: "k6.ext.grafana.app/v1alpha1", Version: "v1alpha1",
		},
	}, groups["k6-app"])
}

func TestParseStaticGroups_PreferredVersionDefaultsToLast(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"static_groups": `[{"name":"grafana-setupguide-app","group":"grafana-setupguide-app.ext.grafana.app","versions":["v0alpha1","v1alpha1"]}]`,
	})
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	groups, err := parseStaticGroups(section)
	require.NoError(t, err)

	require.Equal(t, metav1.GroupVersionForDiscovery{
		GroupVersion: "grafana-setupguide-app.ext.grafana.app/v1alpha1", Version: "v1alpha1",
	}, groups["grafana-setupguide-app"].PreferredVersion)
}

func TestParseStaticGroups_MalformedJSON(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"static_groups": `{not valid json`,
	})
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	_, err := parseStaticGroups(section)
	require.ErrorContains(t, err, "static_groups")
}

func TestParseStaticGroups_MissingName(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"static_groups": `[{"group":"grafana-setupguide-app.ext.grafana.app","versions":["v0alpha1"]}]`,
	})
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	_, err := parseStaticGroups(section)
	require.ErrorContains(t, err, "name")
}

func TestParseStaticGroups_MissingGroup(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"static_groups": `[{"name":"grafana-setupguide-app","versions":["v0alpha1"]}]`,
	})
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	_, err := parseStaticGroups(section)
	require.ErrorContains(t, err, "group")
}

func TestParseStaticGroups_MissingVersions(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"static_groups": `[{"name":"grafana-setupguide-app","group":"grafana-setupguide-app.ext.grafana.app"}]`,
	})
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	_, err := parseStaticGroups(section)
	require.ErrorContains(t, err, "versions")
}

func TestParseStaticGroups_DuplicateName(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{
		"static_groups": `[
			{"name":"grafana-setupguide-app","group":"a.ext.grafana.app","versions":["v0alpha1"]},
			{"name":"grafana-setupguide-app","group":"b.ext.grafana.app","versions":["v0alpha1"]}
		]`,
	})
	section := cfg.SectionWithEnvOverrides(cloudRouterSection)

	_, err := parseStaticGroups(section)
	require.ErrorContains(t, err, "duplicate")
}
