package resources

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMatchesGroup(t *testing.T) {
	tests := []struct {
		name       string
		configured string
		served     string
		want       bool
	}{
		{"exact group", "playlist.grafana.app", "playlist.grafana.app", true},
		{"different group", "playlist.grafana.app", "dashboard.grafana.app", false},
		{"a concrete group never matches by suffix", "datasource.grafana.app", "prometheus.datasource.grafana.app", false},
		{"collection member", "*.datasource.grafana.app", "prometheus.datasource.grafana.app", true},
		{"multi-segment member", "*.datasource.grafana.app", "grafana-testdata-datasource.datasource.grafana.app", true},
		{"the collection group is not its own member", "*.datasource.grafana.app", "datasource.grafana.app", false},
		{"member of another collection", "*.datasource.grafana.app", "playlist.grafana.app", false},
		// App plugin settings are served under the bare plugin ID, so no wildcard reaches them.
		{"name-separated collection member", "*.plugins.grafana.app", "grafana-slo-app", false},
		{"plugin-served app group", "*.ext.grafana.app", "router-test.ext.grafana.app", true},
		// Unlike the identity allow-list wildcard, a member may carry more than one segment.
		{"multi-segment plugin group", "*.ext.grafana.app", "assistant.alertrules.ext.grafana.app", true},
		// A pattern that is not a dotted group names its collection, and matches on its literal part.
		{"qualified suffix member", "*-app@plugins.grafana.app", "grafana-slo-app", true},
		{"qualified suffix non-member", "*-app@plugins.grafana.app", "grafana-app-sdk", false},
		{"the qualified collection is not its own member", "*-app@plugins.grafana.app", "plugins.grafana.app", false},
		{"qualified dotted pattern", "*.datasource.grafana.app@datasource.grafana.app", "loki.datasource.grafana.app", true},
		// The wildcard may sit anywhere, so a member that suffixes a shared prefix matches too.
		{"trailing wildcard", "grafana-*@plugins.grafana.app", "grafana-slo-app", true},
		{"trailing wildcard non-member", "grafana-*@plugins.grafana.app", "acme-slo-app", false},
		{"trailing wildcard standing for nothing", "grafana-*@plugins.grafana.app", "grafana-", false},
		{"wildcard between literals", "grafana-*-app@plugins.grafana.app", "grafana-slo-app", true},
		{"wildcard between literals, wrong tail", "grafana-*-app@plugins.grafana.app", "grafana-slo-datasource", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, MatchesGroup(tt.configured, tt.served))
		})
	}
}

func TestCollectionGroup(t *testing.T) {
	require.Equal(t, "datasource.grafana.app", CollectionGroup("*.datasource.grafana.app"))
	require.Equal(t, "playlist.grafana.app", CollectionGroup("playlist.grafana.app"))
	require.Equal(t, "plugins.grafana.app", CollectionGroup("*-app@plugins.grafana.app"))
}

func TestIsDottedWildcardGroup(t *testing.T) {
	require.True(t, IsDottedWildcardGroup("*.datasource.grafana.app"))
	require.False(t, IsDottedWildcardGroup("*-app"), "the literal part is not a group")
	require.False(t, IsDottedWildcardGroup("grafana-*"), "nor is the literal part of a trailing pattern")
	require.False(t, IsDottedWildcardGroup("*.*.grafana.app"), "one wildcard only")
	require.False(t, IsDottedWildcardGroup("playlist.grafana.app"))
}
