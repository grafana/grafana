package inhibition_rules

import (
	"context"
	"slices"
	"strings"
	"testing"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	"github.com/grafana/alerting/definition"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
)

var (
	testGrafanaRule = v1.NewInhibitionRule(
		"managed-rule-1",
		[]v1.Matcher{
			v1.NewMatcher(v1.MatcherEqual, "alertname", "GrafanaAlert"),
		},
		[]v1.Matcher{
			v1.NewMatcher(v1.MatcherEqual, "alertname", "GrafanaTarget"),
		},
		[]string{"instance"},
		models.ProvenanceNone,
	)

	// testImportedRule is used as input when building the Mimir config fixture.
	// Its UID is not reflected in the merge output; use buildExpectedImportedRule
	// to obtain the post-merge rule with a hash-based UID.
	testImportedRule = v1.NewInhibitionRule(
		"test-mimir-imported-inhibition-rule-00000",
		[]v1.Matcher{
			v1.NewMatcher(v1.MatcherEqual, "__grafana_managed_route__", "test-mimir"),
			v1.NewMatcher(v1.MatcherEqual, "alertname", "ImportedAlert"),
		},
		[]v1.Matcher{
			v1.NewMatcher(v1.MatcherEqual, "__grafana_managed_route__", "test-mimir"),
			v1.NewMatcher(v1.MatcherEqual, "alertname", "ImportedTarget"),
		},
		[]string{"cluster"},
		models.ProvenanceConvertedPrometheus,
	)
)

func TestService_GetInhibitionRules(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)
	grafanaRules, importedRules := getTestRules(t)

	tt := []struct {
		name           string
		enableImported bool
		grafanaRules   []v1.InhibitionRule
		importedRules  []v1.InhibitionRule
		expErr         error
		expRules       []v1.InhibitionRule
	}{
		{
			name:           "returns both Grafana and imported inhibition rules",
			enableImported: true,
			grafanaRules:   grafanaRules,
			importedRules:  importedRules,
			expErr:         nil,
			expRules:       sortedByUID(append(grafanaRules, importedRules...)),
		},
		{
			name:           "returns only Grafana rules when no imported config",
			enableImported: true,
			grafanaRules:   grafanaRules,
			expErr:         nil,
			expRules:       grafanaRules,
		},
		{
			name:           "returns only imported rules when no grafana rules",
			enableImported: true,
			importedRules:  importedRules,
			expErr:         nil,
			expRules:       importedRules,
		},
		{
			name:           "returns only grafana rules when flags are disabled",
			enableImported: false,
			grafanaRules:   grafanaRules,
			importedRules:  importedRules,
			expErr:         nil,
			expRules:       grafanaRules,
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			sut, store := createInhibitionRuleSvcSut(tc.enableImported)
			revision := createTestConfig(t, tc.grafanaRules, tc.importedRules)
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}

			rules, err := sut.GetInhibitionRules(ctx, orgID)
			require.ErrorIs(t, err, tc.expErr)
			require.Equal(t, tc.expRules, rules)
		})
	}
}

func TestService_GetInhibitionRule(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)
	grafanaRules, importedRules := getTestRules(t)

	tt := []struct {
		name          string
		grafanaRules  []v1.InhibitionRule
		importedRules []v1.InhibitionRule
		ruleUID       v1.ResourceUID
		expErr        error
		expRule       v1.InhibitionRule
	}{
		{
			name:         "can fetch grafana rule by UID",
			grafanaRules: grafanaRules,
			ruleUID:      testGrafanaRule.UID,
			expRule:      testGrafanaRule,
		},
		{
			name:          "can fetch imported rule by UID",
			importedRules: importedRules,
			ruleUID:       importedRules[0].UID,
			expRule:       importedRules[0],
		},
		{
			name:   "returns not found for non-existent UID",
			expErr: models.ErrInhibitionRuleNotFound,
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			sut, store := createInhibitionRuleSvcSut(true)
			revision := createTestConfig(t, tc.grafanaRules, tc.importedRules)
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}

			result, err := sut.GetInhibitionRule(ctx, tc.ruleUID, orgID)
			require.ErrorIs(t, tc.expErr, err)
			require.Equal(t, tc.expRule, result)
		})
	}
}

func TestService_UpdateInhibitionRule(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)
	grafanaRules, importedRules := getTestRules(t)

	tt := []struct {
		name          string
		grafanaRules  []v1.InhibitionRule
		importedRules []v1.InhibitionRule
		updatedRule   v1.InhibitionRule
		version       string
		expErr        error
		expRule       v1.InhibitionRule
	}{
		{
			name:         "can update grafana rule",
			grafanaRules: grafanaRules,
			updatedRule: func() v1.InhibitionRule {
				return v1.NewInhibitionRule(
					string(testGrafanaRule.UID),
					testGrafanaRule.SourceMatchers,
					testGrafanaRule.TargetMatchers,
					[]string{"instance", "job"},
					testGrafanaRule.Provenance,
				)
			}(),
			version: testGrafanaRule.Version,
			expRule: func() v1.InhibitionRule {
				return v1.NewInhibitionRule(
					string(testGrafanaRule.UID),
					testGrafanaRule.SourceMatchers,
					testGrafanaRule.TargetMatchers,
					[]string{"instance", "job"},
					testGrafanaRule.Provenance,
				)
			}(),
		},
		{
			name:          "can't update imported rule",
			importedRules: importedRules,
			updatedRule:   importedRules[0],
			expErr:        models.MakeErrInhibitionRuleOrigin(string(importedRules[0].UID), "update"),
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			sut, store := createInhibitionRuleSvcSut(true)
			revision := createTestConfig(t, tc.grafanaRules, tc.importedRules)
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}

			result, err := sut.UpdateInhibitionRule(ctx, tc.updatedRule, tc.version, orgID)
			require.ErrorIs(t, err, tc.expErr)
			require.Equal(t, tc.expRule, result)

			// if not errors, ensure only updated rule is returned in list after update
			if tc.expErr == nil {
				listRes, err := sut.GetInhibitionRules(ctx, orgID)
				require.Nil(t, err)

				require.Equal(t, []v1.InhibitionRule{tc.expRule}, listRes)
			}
		})
	}
}

func TestService_DeleteInhibitionRule(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)
	grafanaRules, importedRules := getTestRules(t)

	tt := []struct {
		name          string
		grafanaRules  []v1.InhibitionRule
		importedRules []v1.InhibitionRule
		ruleUID       v1.ResourceUID
		expErr        error
	}{
		{
			name:         "can delete grafana rule",
			grafanaRules: grafanaRules,
			ruleUID:      testGrafanaRule.UID,
		},
		{
			name:          "can't delete imported rule",
			importedRules: importedRules,
			ruleUID:       importedRules[0].UID,
			expErr:        models.MakeErrInhibitionRuleOrigin(string(importedRules[0].UID), "delete"),
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			sut, store := createInhibitionRuleSvcSut(true)
			revision := createTestConfig(t, tc.grafanaRules, tc.importedRules)
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}

			err := sut.DeleteInhibitionRule(ctx, tc.ruleUID, orgID, models.ProvenanceAPI, "")
			require.ErrorIs(t, err, tc.expErr)

			// if no error expected, ensure deleted rule is not returned in list after deletion
			if tc.expErr == nil {
				listRes, err := sut.GetInhibitionRules(ctx, orgID)
				require.Nil(t, err)

				listMap := make(map[v1.ResourceUID]v1.InhibitionRule, len(listRes))
				for _, r := range listRes {
					listMap[r.UID] = r
				}

				require.NotContains(t, listMap, tc.ruleUID)
			}
		})
	}
}

// Test helpers

func createInhibitionRuleSvcSut(enableImported bool) (*Service, *legacy_storage.AlertmanagerConfigStoreFake) {
	store := &legacy_storage.AlertmanagerConfigStoreFake{}
	logger := log.NewNopLogger()
	var ff featuremgmt.FeatureToggles
	if enableImported {
		ff = featuremgmt.WithFeatures(
			featuremgmt.FlagAlertingMultiplePolicies,
			featuremgmt.FlagAlertingImportAlertmanagerAPI,
		)
	}
	return NewService(store, logger, ff, validation.ValidateProvenanceRelaxed), store
}

func createTestConfig(t *testing.T, grafanaRules, importedRules []v1.InhibitionRule) *legacy_storage.ConfigRevision {
	t.Helper()

	inhibitionRules := make(map[v1.ResourceUID]v1.InhibitionRule, len(grafanaRules))
	for _, r := range grafanaRules {
		inhibitionRules[r.UID] = r
	}

	cfg := &v1.AMConfigV1{
		InhibitionRules: inhibitionRules,
		AlertmanagerConfig: v1.PostableApiAlertingConfig{
			Config: v1.Config{
				Route: &v1.Route{
					Receiver: "default",
				},
			},
		},
		ManagedRoutes: map[string]*v1.Route{
			"default-route": {Receiver: "default"},
		},
	}

	if len(importedRules) > 0 {
		mimirConfig := buildMimirAMConfigWithInhibitRules(t, importedRules)
		cfg.ExtraConfigs = []v1.ExtraConfiguration{
			{
				Identifier:         "test-mimir",
				AlertmanagerConfig: mimirConfig,
			},
		}
	}

	return &legacy_storage.ConfigRevision{Config: cfg}
}

func buildMimirAMConfigWithInhibitRules(t *testing.T, rules []v1.InhibitionRule) string {
	t.Helper()

	c := definition.PostableApiAlertingConfig{
		Config: definition.Config{
			Route: &definition.Route{
				Receiver: "default",
			},
		},
		Receivers: []*definition.PostableApiReceiver{
			{
				Receiver: definitions.Receiver{
					Name: "default",
				},
			},
		},
	}

	for _, r := range rules {
		ir, err := notifier.InhibitionRuleToAPI(r)
		require.Nil(t, err)

		sm := make([]*labels.Matcher, 0, len(ir.SourceMatchers))
		for _, m := range ir.SourceMatchers {
			if m.Name != "__grafana_managed_route__" {
				sm = append(sm, m)
			}
		}
		ir.SourceMatchers = sm

		tm := make([]*labels.Matcher, 0, len(ir.TargetMatchers))
		for _, m := range ir.TargetMatchers {
			if m.Name != "__grafana_managed_route__" {
				tm = append(tm, m)
			}
		}
		ir.TargetMatchers = tm

		c.InhibitRules = append(c.InhibitRules, ir.InhibitRule)
	}

	d, err := yaml.Marshal(c)
	require.Nil(t, err)

	return string(d)
}

// buildExpectedImportedRule returns the inhibition rule as it appears after
// MergeInhibitionRules processes the Mimir config built from testImportedRule.
// MergeInhibitionRules assigns a hash-based UID and appends the scope matcher last,
// so the result differs from testImportedRule in both UID and matcher order.
func buildExpectedImportedRule(t *testing.T) v1.InhibitionRule {
	t.Helper()

	mimirConfig := buildMimirAMConfigWithInhibitRules(t, []v1.InhibitionRule{testImportedRule})
	cfg := &v1.AMConfigV1{
		AlertmanagerConfig: v1.PostableApiAlertingConfig{
			Config: v1.Config{
				Route: &v1.Route{Receiver: "default"},
			},
		},
		ManagedRoutes: map[string]*v1.Route{},
		ExtraConfigs: []v1.ExtraConfiguration{
			{
				Identifier:         "test-mimir",
				AlertmanagerConfig: mimirConfig,
			},
		},
	}
	rev := &legacy_storage.ConfigRevision{Config: cfg}
	imported, err := rev.Imported()
	require.NoError(t, err)
	rules, err := imported.GetInhibitRules()
	require.NoError(t, err)
	require.Len(t, rules, 1)
	for _, r := range rules {
		return r
	}
	panic("unreachable")
}

func getTestRules(t *testing.T) (grafanaRules, importedRules []v1.InhibitionRule) {
	return []v1.InhibitionRule{testGrafanaRule}, []v1.InhibitionRule{buildExpectedImportedRule(t)}
}

// sortedByUID returns a copy of rules sorted by UID, matching the order returned by GetInhibitionRules.
func sortedByUID(rules []v1.InhibitionRule) []v1.InhibitionRule {
	sorted := slices.Clone(rules)
	slices.SortFunc(sorted, func(a, b v1.InhibitionRule) int {
		return strings.Compare(string(a.UID), string(b.UID))
	})
	return sorted
}
