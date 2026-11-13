package dashboard

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// The table is written out by hand, so a path added to the schema without an entry would never merge.
func TestDashboardPreferencesFieldPathsMatchSchema(t *testing.T) {
	want := dashboardPreferencesSchemaResetPaths(t)
	slices.Sort(want)

	got := make([]string, 0, len(dashboardPreferencesFieldPaths))
	for _, path := range dashboardPreferencesFieldPaths {
		got = append(got, string(path))
	}
	slices.Sort(got)

	require.Equal(t, want, got)
}

func TestMergeDashboardPreferences(t *testing.T) {
	tier := func(kind dashboardPreferencesTier, name, spec string) dashboardPreferencesMergeTier {
		return dashboardPreferencesMergeTier{tier: kind, name: name, spec: dashboardPreferencesSpecFromJSON(t, spec)}
	}
	reset := func(source dashv2beta1.DashboardPreferencesMergedSource) dashv2beta1.DashboardPreferencesMergedSource {
		source.Reset = true
		return source
	}
	fromUser := dashv2beta1.DashboardPreferencesMergedSource{Tier: dashv2beta1.DashboardPreferencesMergedTierUser, Name: "user-u1"}
	fromFolder := dashv2beta1.DashboardPreferencesMergedSource{Tier: dashv2beta1.DashboardPreferencesMergedTierFolder, Name: "folder-c"}
	fromOrg := dashv2beta1.DashboardPreferencesMergedSource{Tier: dashv2beta1.DashboardPreferencesMergedTierOrg, Name: dashv2beta1.DashboardPreferencesOrgName}

	tests := []struct {
		name        string
		tiers       []dashboardPreferencesMergeTier
		wantSpec    string
		wantSources map[string]dashv2beta1.DashboardPreferencesMergedSource
	}{
		{
			name:        "no tiers",
			wantSpec:    `{}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{},
		},
		{
			name: "the highest tier that sets a field wins",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierUser, "user-u1", `{"dashboard":{"preload":false}}`),
				tier(dashboardPreferencesTierFolder, "folder-c", `{"dashboard":{"preload":true,"autoRefresh":"30s"}}`),
				tier(dashboardPreferencesTierFolder, "", `{"dashboard":{"cursorSync":"Crosshair","autoRefresh":"5m"}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"autoRefresh":"1m","timeRange":{"from":"now-6h","to":"now"}}}`),
			},
			wantSpec: `{"dashboard":{"preload":false,"autoRefresh":"30s","cursorSync":"Crosshair","timeRange":{"from":"now-6h","to":"now"}}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.preload":     fromUser,
				"dashboard.autoRefresh": fromFolder,
				"dashboard.cursorSync":  {Tier: dashv2beta1.DashboardPreferencesMergedTierFolder},
				"dashboard.timeRange":   fromOrg,
			},
		},
		{
			name: "false and 0 are values",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierUser, "user-u1", `{"dashboard":{"preload":false,"fiscalYearStartMonth":0}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"preload":true,"fiscalYearStartMonth":3}}`),
			},
			wantSpec: `{"dashboard":{"preload":false,"fiscalYearStartMonth":0}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.preload":              fromUser,
				"dashboard.fiscalYearStartMonth": fromUser,
			},
		},
		{
			name: "timeRange comes whole from one tier",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierFolder, "folder-c", `{"dashboard":{"timeRange":{"from":"now-1h","to":"now"}}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"timeRange":{"from":"now-7d","to":"now-1d"}}}`),
			},
			wantSpec: `{"dashboard":{"timeRange":{"from":"now-1h","to":"now"}}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.timeRange": fromFolder,
			},
		},
		{
			name: "each autoGrid member is its own field",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierFolder, "folder-c", `{"dashboard":{"autoGrid":{"columnWidth":300}}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"layout":"AutoGridLayout","autoGrid":{"columnWidth":200,"rowHeight":150}}}`),
			},
			wantSpec: `{"dashboard":{"layout":"AutoGridLayout","autoGrid":{"columnWidth":300,"rowHeight":150}}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.layout":               fromOrg,
				"dashboard.autoGrid.columnWidth": fromFolder,
				"dashboard.autoGrid.rowHeight":   fromOrg,
			},
		},
		{
			name: "a reset stops the cascade",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierFolder, "folder-c", `{"reset":["dashboard.timeRange"]}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"preload":true,"timeRange":{"from":"now-6h","to":"now"}}}`),
			},
			wantSpec: `{"dashboard":{"preload":true}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.preload":   fromOrg,
				"dashboard.timeRange": reset(fromFolder),
			},
		},
		{
			name: "a reset leaves no empty object",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierUser, "user-u1", `{"reset":["dashboard.autoGrid.columnWidth"]}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"autoGrid":{"columnWidth":200}}}`),
			},
			wantSpec: `{}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.autoGrid.columnWidth": reset(fromUser),
			},
		},
		{
			name: "a reset below a value has no effect",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierUser, "user-u1", `{"dashboard":{"preload":true}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"reset":["dashboard.preload"]}`),
			},
			wantSpec: `{"dashboard":{"preload":true}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.preload": fromUser,
			},
		},
		{
			name: "panel fields merge like dashboard fields",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierUser, "user-u1", `{"panels":{"legend":{"placement":"right"}}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"panels":{"legend":{"placement":"bottom","showLegend":true},"field":{"decimals":2}},"reset":["panels.tooltip.mode"]}`),
			},
			wantSpec: `{"panels":{"legend":{"placement":"right","showLegend":true},"field":{"decimals":2}}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"panels.legend.placement":  fromUser,
				"panels.legend.showLegend": fromOrg,
				"panels.field.decimals":    fromOrg,
				"panels.tooltip.mode":      reset(fromOrg),
			},
		},
		{
			name: "autoRefreshIntervals comes whole",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierUser, "user-u1", `{"dashboard":{"autoRefreshIntervals":["10s"]}}`),
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"autoRefreshIntervals":["1m","5m"]}}`),
			},
			wantSpec: `{"dashboard":{"autoRefreshIntervals":["10s"]}}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.autoRefreshIntervals": fromUser,
			},
		},
		{
			name: "set and reset in one tier: the reset wins",
			tiers: []dashboardPreferencesMergeTier{
				tier(dashboardPreferencesTierOrg, dashv2beta1.DashboardPreferencesOrgName, `{"dashboard":{"preload":true},"reset":["dashboard.preload"]}`),
			},
			wantSpec: `{}`,
			wantSources: map[string]dashv2beta1.DashboardPreferencesMergedSource{
				"dashboard.preload": reset(fromOrg),
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			merged, err := mergeDashboardPreferences(tt.tiers)
			require.NoError(t, err)

			require.Equal(t, tt.wantSources, merged.Sources)
			// Compares the whole encoding, so the no tiers row pins the response for nothing stored.
			encoded, err := json.Marshal(merged)
			require.NoError(t, err)
			sources, err := json.Marshal(tt.wantSources)
			require.NoError(t, err)
			require.JSONEq(t, `{"kind":"DashboardPreferencesMerged","apiVersion":"dashboard.grafana.app/v2beta1","spec":`+tt.wantSpec+`,"sources":`+string(sources)+`}`, string(encoded))
		})
	}
}

func TestMergeDashboardPreferencesEveryField(t *testing.T) {
	const everyField = `{"dashboard":{"preload":true,"autoRefresh":"1m","autoRefreshIntervals":["30s","1m"],"timeRange":{"from":"now-6h","to":"now"},"fiscalYearStartMonth":3,"nowDelay":"1m","hideTimepicker":true,"cursorSync":"Crosshair","layout":"AutoGridLayout","autoGrid":{"maxColumnCount":4,"columnWidthMode":"custom","columnWidth":300,"rowHeightMode":"custom","rowHeight":200,"fillScreen":true}},"panels":{"legend":{"showLegend":true,"placement":"right","displayMode":"table"},"tooltip":{"mode":"multi","sort":"desc","hideZeros":true},"axis":{"axisPlacement":"left","axisGridShow":true,"axisBorderShow":true,"axisCenteredZero":true,"scale":"log2"},"graph":{"lineInterpolation":"smooth","lineWidth":2,"fillOpacity":10,"gradientMode":"opacity","showPoints":"never","pointSize":5},"field":{"decimals":2},"frame":{"transparent":true}}}`
	fixture := dashboardPreferencesSpecFromJSON(t, everyField)
	paths := dashboardPreferencesSchemaResetPaths(t)

	encodedFixture := encodeDashboardPreferencesSpec(t, fixture)
	for _, path := range paths {
		require.True(t, isDashboardPreferencesFieldSet(encodedFixture, path), "the fixture doesn't set %s", path)
	}

	fromOrg := dashv2beta1.DashboardPreferencesMergedSource{Tier: dashv2beta1.DashboardPreferencesMergedTierOrg, Name: dashv2beta1.DashboardPreferencesOrgName}
	org := dashboardPreferencesMergeTier{tier: dashboardPreferencesTierOrg, name: dashv2beta1.DashboardPreferencesOrgName, spec: fixture}

	t.Run("every field from one tier", func(t *testing.T) {
		merged, err := mergeDashboardPreferences([]dashboardPreferencesMergeTier{org})
		require.NoError(t, err)

		spec, err := json.Marshal(merged.Spec)
		require.NoError(t, err)
		require.JSONEq(t, everyField, string(spec))
		require.Len(t, merged.Sources, len(paths))
		for _, path := range paths {
			require.Equal(t, fromOrg, merged.Sources[path], path)
		}
	})

	for _, path := range paths {
		t.Run("reset of "+path, func(t *testing.T) {
			merged, err := mergeDashboardPreferences([]dashboardPreferencesMergeTier{
				{
					tier: dashboardPreferencesTierUser,
					name: "user-u1",
					spec: dashv2beta1.DashboardPreferencesSpec{Reset: []dashv2beta1.DashboardPreferencesResetPath{dashv2beta1.DashboardPreferencesResetPath(path)}},
				},
				org,
			})
			require.NoError(t, err)

			encoded := encodeDashboardPreferencesSpec(t, merged.Spec)
			for _, other := range paths {
				require.Equal(t, other != path, isDashboardPreferencesFieldSet(encoded, other), other)
			}
			require.Equal(t, dashv2beta1.DashboardPreferencesMergedSource{Tier: dashv2beta1.DashboardPreferencesMergedTierUser, Name: "user-u1", Reset: true}, merged.Sources[path])
			require.Len(t, merged.Sources, len(paths))
		})
	}
}

// Decodes strictly, so a misspelled key in a fixture fails the test instead of leaving the field unset.
func dashboardPreferencesSpecFromJSON(t *testing.T, s string) dashv2beta1.DashboardPreferencesSpec {
	t.Helper()
	decoder := json.NewDecoder(strings.NewReader(s))
	decoder.DisallowUnknownFields()
	var spec dashv2beta1.DashboardPreferencesSpec
	require.NoError(t, decoder.Decode(&spec))
	return spec
}

func dashboardPreferencesSchemaResetPaths(t *testing.T) []string {
	t.Helper()
	specSchema, err := dashboardPreferencesSpecSchema()
	require.NoError(t, err)
	enum := specSchema.Properties["reset"].Value.Items.Value.Enum
	paths := make([]string, 0, len(enum))
	for _, value := range enum {
		paths = append(paths, value.(string))
	}
	return paths
}

// encodeDashboardPreferencesSpec returns spec as admission sees it, in which an unset field is absent.
func encodeDashboardPreferencesSpec(t *testing.T, spec any) any {
	t.Helper()
	raw, err := json.Marshal(spec)
	require.NoError(t, err)
	var encoded any
	require.NoError(t, json.Unmarshal(raw, &encoded))
	return encoded
}
