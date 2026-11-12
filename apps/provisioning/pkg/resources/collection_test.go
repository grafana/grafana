package resources

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCoversGroup(t *testing.T) {
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
		{"a bare wildcard covers any served group", "*@plugins.grafana.app", "grafana-slo-app", true},
		{"no served group", "*.datasource.grafana.app", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, CoversGroup(tt.configured, tt.served))
		})
	}
}

func TestIsCollection(t *testing.T) {
	tests := []struct {
		name  string
		group string
		want  bool
	}{
		{"served group", "playlist.grafana.app", false},
		{"dotted pattern", "*.datasource.grafana.app", true},
		{"trailing pattern", "grafana-*", true},
		{"qualified pattern", "*-app@plugins.grafana.app", true},
		{"no group", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, IsCollection(tt.group))
		})
	}
}

func TestIsDottedCollection(t *testing.T) {
	tests := []struct {
		name  string
		group string
		want  bool
	}{
		{"dotted pattern", "*.datasource.grafana.app", true},
		{"literal part is not a group", "*-app", false},
		{"literal part of a trailing pattern is not a group", "grafana-*", false},
		{"one wildcard only", "*.*.grafana.app", false},
		{"served group", "playlist.grafana.app", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, IsDottedCollection(tt.group))
		})
	}
}

func TestCollectionGroup(t *testing.T) {
	tests := []struct {
		name       string
		configured string
		want       string
	}{
		{"dotted pattern names its collection", "*.datasource.grafana.app", "datasource.grafana.app"},
		{"served group is its own collection", "playlist.grafana.app", "playlist.grafana.app"},
		{"qualifier wins", "*-app@plugins.grafana.app", "plugins.grafana.app"},
		{"qualifier wins over the literal part", "*.datasource.grafana.app@shared.grafana.app", "shared.grafana.app"},
		{"trailing pattern", "grafana-*@plugins.grafana.app", "plugins.grafana.app"},
		// Unqualified and not dotted, which ParseSupportedResources rejects: there is no
		// collection to name, so the pattern stands for itself.
		{"unqualified non-dotted pattern", "*-app", "*-app"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, CollectionGroup(tt.configured))
		})
	}
}
