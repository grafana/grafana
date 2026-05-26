package inhibition_rules

import (
	"context"
	"testing"

	"go.yaml.in/yaml/v3"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/require"

	"github.com/grafana/alerting/definition"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
)

var (
	testGrafanaRule = v1.InhibitionRule{
		Name:       "managed-rule-1",
		Provenance: v1.Provenance(models.ProvenanceNone),
		InhibitRule: definitions.InhibitRule{
			SourceMatchers: []*labels.Matcher{
				{
					Type:  labels.MatchEqual,
					Name:  "alertname",
					Value: "GrafanaAlert",
				},
			},
			TargetMatchers: []*labels.Matcher{
				{
					Type:  labels.MatchEqual,
					Name:  "alertname",
					Value: "GrafanaTarget",
				},
			},
			Equal: []string{"instance"},
		},
	}

	testImportedRule = v1.InhibitionRule{
		Name:       "test-mimir-imported-inhibition-rule-00000",
		Provenance: v1.Provenance(models.ProvenanceConvertedPrometheus),
		InhibitRule: definitions.InhibitRule{
			SourceMatchers: []*labels.Matcher{
				{
					Type:  labels.MatchEqual,
					Name:  "__grafana_managed_route__",
					Value: "test-mimir",
				},
				{
					Type:  labels.MatchEqual,
					Name:  "alertname",
					Value: "ImportedAlert",
				},
			},
			TargetMatchers: []*labels.Matcher{
				{
					Type:  labels.MatchEqual,
					Name:  "__grafana_managed_route__",
					Value: "test-mimir",
				},
				{
					Type:  labels.MatchEqual,
					Name:  "alertname",
					Value: "ImportedTarget",
				},
			},
			Equal: []string{"cluster"},
		},
	}
)

func TestService_GetInhibitionRules(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)
	grafanaRules, importedRules := getTestRules()

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
			expRules:       append(grafanaRules, importedRules...),
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
	grafanaRules, importedRules := getTestRules()

	tt := []struct {
		name          string
		grafanaRules  []v1.InhibitionRule
		importedRules []v1.InhibitionRule
		ruleName      string
		expErr        error
		expRule       v1.InhibitionRule
	}{
		{
			name:         "can fetch grafana rule by name",
			grafanaRules: grafanaRules,
			ruleName:     testGrafanaRule.Name,
			expRule:      testGrafanaRule,
		},
		{
			name:          "can fetch imported rule by name",
			importedRules: importedRules,
			ruleName:      testImportedRule.Name,
			expRule:       testImportedRule,
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

			result, err := sut.GetInhibitionRule(ctx, tc.ruleName, orgID)
			require.ErrorIs(t, tc.expErr, err)
			require.Equal(t, tc.expRule, result)
		})
	}
}

func TestService_UpdateInhibitionRule(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)
	grafanaRules, importedRules := getTestRules()

	tt := []struct {
		name          string
		grafanaRules  []v1.InhibitionRule
		importedRules []v1.InhibitionRule
		ruleName      string
		version       string
		updatedRule   v1.InhibitionRule
		expErr        error
		expRule       v1.InhibitionRule
	}{
		{
			name:         "can update grafana rule",
			grafanaRules: grafanaRules,
			ruleName:     testGrafanaRule.Name,
			version:      testGrafanaRule.Fingerprint(),
			updatedRule: func() v1.InhibitionRule {
				r := testGrafanaRule
				r.Equal = []string{"instance", "job"}
				return r
			}(),
			expRule: func() v1.InhibitionRule {
				r := testGrafanaRule
				r.Equal = []string{"instance", "job"}
				updated, err := v1.InhibitRuleToInhibitionRule(r.Name, r.InhibitRule, r.Provenance)
				require.Nil(t, err)
				return *updated
			}(),
		},
		{
			name:         "can update rule name (create new rule with updated name and delete old one)",
			grafanaRules: grafanaRules,
			ruleName:     testGrafanaRule.Name,
			version:      testGrafanaRule.Fingerprint(),
			updatedRule: func() v1.InhibitionRule {
				r := testGrafanaRule
				r.Name = "managed-rule-1-renamed"
				return r
			}(),
			expRule: func() v1.InhibitionRule {
				r := testGrafanaRule
				r.Name = "managed-rule-1-renamed"
				updated, err := v1.InhibitRuleToInhibitionRule(r.Name, r.InhibitRule, r.Provenance)
				require.Nil(t, err)
				return *updated
			}(),
		},
		{
			name:          "can't update imported rule",
			importedRules: importedRules,
			ruleName:      testImportedRule.Name,
			updatedRule:   testImportedRule,
			expErr:        models.MakeErrInhibitionRuleOrigin(testImportedRule.Name, "update"),
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			sut, store := createInhibitionRuleSvcSut(true)
			revision := createTestConfig(t, tc.grafanaRules, tc.importedRules)
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}

			result, err := sut.UpdateInhibitionRule(ctx, tc.ruleName, tc.updatedRule, tc.version, orgID)
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
	grafanaRules, importedRules := getTestRules()

	tt := []struct {
		name          string
		grafanaRules  []v1.InhibitionRule
		importedRules []v1.InhibitionRule
		ruleName      string
		expErr        error
		expRule       v1.InhibitionRule
	}{
		{
			name:          "can delete grafana rule",
			importedRules: grafanaRules,
			ruleName:      testGrafanaRule.Name,
			expRule:       testGrafanaRule,
		},
		{
			name:          "can't delete imported rule",
			importedRules: importedRules,
			ruleName:      testImportedRule.Name,
			expErr:        models.MakeErrInhibitionRuleOrigin(testImportedRule.Name, "delete"),
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			sut, store := createInhibitionRuleSvcSut(true)
			revision := createTestConfig(t, tc.grafanaRules, tc.importedRules)
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}

			err := sut.DeleteInhibitionRule(ctx, tc.ruleName, orgID, models.ProvenanceAPI, "")
			require.ErrorIs(t, err, tc.expErr)

			// if no error expected, ensure deleted rule is not returned in list after deletion
			if tc.expErr == nil {
				listRes, err := sut.GetInhibitionRules(ctx, orgID)
				require.Nil(t, err)

				listMap := make(map[string]v1.InhibitionRule, len(listRes))
				for _, r := range listRes {
					listMap[r.Name] = r
				}

				require.NotContains(t, listMap, tc.ruleName)
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

	managedIRs := make(v1.ManagedInhibitionRules, len(grafanaRules))
	for _, r := range grafanaRules {
		managedIRs[r.Name] = &r
	}

	cfg := &v1.AMConfigV1{
		ManagedInhibitionRules: managedIRs,
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

	mimirConfig := buildMimirAMConfigWithInhibitRules(t, importedRules)
	cfg.ExtraConfigs = []v1.ExtraConfiguration{
		{
			Identifier:         "test-mimir",
			AlertmanagerConfig: mimirConfig,
		},
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
		ir := r.InhibitRule

		sm := make([]*labels.Matcher, 0, len(r.SourceMatchers))
		for _, m := range r.SourceMatchers {
			if m.Name != "__grafana_managed_route__" {
				sm = append(sm, m)
			}
		}
		ir.SourceMatchers = sm

		tm := make([]*labels.Matcher, 0, len(r.TargetMatchers))
		for _, m := range r.TargetMatchers {
			if m.Name != "__grafana_managed_route__" {
				tm = append(tm, m)
			}
		}
		ir.TargetMatchers = tm

		c.InhibitRules = append(c.InhibitRules, ir)
	}

	d, err := yaml.Marshal(c)
	require.Nil(t, err)

	return string(d)
}

func getTestRules() (grafanaRules, importedRules []v1.InhibitionRule) {
	return []v1.InhibitionRule{testGrafanaRule}, []v1.InhibitionRule{testImportedRule}
}
