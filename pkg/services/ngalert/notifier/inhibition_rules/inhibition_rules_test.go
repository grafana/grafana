package inhibition_rules

import (
	"context"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
)

func TestService_GetInhibitionRules(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)

	grafanaRules := []config.InhibitRule{
		{
			SourceMatchers: config.Matchers{
				{Type: labels.MatchEqual, Name: "alertname", Value: "GrafanaAlert"},
			},
			TargetMatchers: config.Matchers{
				{Type: labels.MatchEqual, Name: "alertname", Value: "GrafanaTarget"},
			},
			Equal: []string{"instance"},
		},
	}

	importedRules := []config.InhibitRule{
		{
			SourceMatchers: config.Matchers{
				{Type: labels.MatchEqual, Name: "alertname", Value: "ImportedAlert"},
			},
			TargetMatchers: config.Matchers{
				{Type: labels.MatchEqual, Name: "alertname", Value: "ImportedTarget"},
			},
			Equal: []string{"cluster"},
		},
	}

	t.Run("returns both Grafana and imported inhibition rules", func(t *testing.T) {
		sut, store, prov := createInhibitionRuleSvcSut()
		revision := createConfigWithImportedInhibitRules(grafanaRules, importedRules)
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return revision, nil
		}
		prov.On("GetProvenances", ctx, orgID, models.ResourceTypeInhibitionRule).Return(map[string]models.Provenance{}, nil)

		result, err := sut.GetInhibitionRules(ctx, orgID)
		require.NoError(t, err)
		require.Equal(t, []models.InhibitionRule{
			{
				UID:        "d3b79c7022fa9fb5",
				Version:    "d3b79c7022fa9fb5",
				Provenance: models.ProvenanceNone,
				Origin:     models.ResourceOriginGrafana,
				InhibitRule: config.InhibitRule{
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
			},
			{
				UID:        "9c41a6c13896a6dc",
				Version:    "9c41a6c13896a6dc",
				Provenance: models.ProvenanceConvertedPrometheus,
				Origin:     models.ResourceOriginImported,
				InhibitRule: config.InhibitRule{
					SourceMatchers: []*labels.Matcher{
						{
							Type:  labels.MatchEqual,
							Name:  "alertname",
							Value: "ImportedAlert",
						},
						{
							Type:  labels.MatchEqual,
							Name:  "__grafana_managed_route__",
							Value: "test-mimir",
						},
					},
					TargetMatchers: []*labels.Matcher{
						{
							Type:  labels.MatchEqual,
							Name:  "alertname",
							Value: "ImportedTarget",
						},
						{
							Type:  labels.MatchEqual,
							Name:  "__grafana_managed_route__",
							Value: "test-mimir",
						},
					},
					Equal: []string{"cluster"},
				},
			},
		}, result)
	})

	t.Run("returns only Grafana rules when no imported config", func(t *testing.T) {
		sut, store, prov := createInhibitionRuleSvcSut()
		revision := createConfigWithImportedInhibitRules(grafanaRules, nil)
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return revision, nil
		}
		prov.On("GetProvenances", ctx, orgID, models.ResourceTypeInhibitionRule).Return(map[string]models.Provenance{}, nil)

		result, err := sut.GetInhibitionRules(ctx, orgID)
		require.NoError(t, err)
		require.Len(t, result, 1)
		assert.Equal(t, models.ProvenanceNone, result[0].Provenance)
	})
}

func TestService_GetInhibitionRule_WithImported(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)

	importedRule := config.InhibitRule{
		SourceMatchers: config.Matchers{
			{Type: labels.MatchEqual, Name: "alertname", Value: "ImportedAlert"},
		},
		TargetMatchers: config.Matchers{
			{Type: labels.MatchEqual, Name: "alertname", Value: "ImportedTarget"},
		},
		Equal: []string{"cluster"},
	}

	t.Run("can fetch imported rule by UID", func(t *testing.T) {
		sut, store, prov := createInhibitionRuleSvcSut()
		revision := createConfigWithImportedInhibitRules(nil, []config.InhibitRule{importedRule})
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return revision, nil
		}
		prov.On("GetProvenances", ctx, orgID, models.ResourceTypeInhibitionRule).Return(map[string]models.Provenance{}, nil)

		// First, list all rules to get the actual UID (after matchers are added)
		allRules, err := sut.GetInhibitionRules(ctx, orgID)
		require.NoError(t, err)
		require.Len(t, allRules, 1)

		importedUID := allRules[0].UID

		// Now fetch by UID
		result, err := sut.GetInhibitionRule(ctx, importedUID, orgID)

		require.NoError(t, err)
		assert.Equal(t, importedUID, result.UID)
		assert.Equal(t, models.ProvenanceConvertedPrometheus, result.Provenance)
		assert.Len(t, result.SourceMatchers, 2) // Original + managed route matcher
	})

	t.Run("returns not found for non-existent UID", func(t *testing.T) {
		sut, store, prov := createInhibitionRuleSvcSut()
		revision := createConfigWithImportedInhibitRules(nil, nil)
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return revision, nil
		}
		prov.On("GetProvenance", ctx, newInhibitionRule(&config.InhibitRule{}, "", models.ProvenanceNone), orgID).Maybe().Return(models.ProvenanceNone, nil)

		_, err := sut.GetInhibitionRule(ctx, "non-existent-uid", orgID)
		require.Error(t, err)
		assert.ErrorIs(t, err, models.ErrInhibitionRuleNotFound)
	})
}

func TestService_UpdateInhibitionRule_RejectsImported(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)

	importedRule := config.InhibitRule{
		SourceMatchers: config.Matchers{
			{Type: labels.MatchEqual, Name: "alertname", Value: "ImportedAlert"},
		},
		TargetMatchers: config.Matchers{
			{Type: labels.MatchEqual, Name: "alertname", Value: "ImportedTarget"},
		},
		Equal: []string{"cluster"},
	}

	sut, store, prov := createInhibitionRuleSvcSut()
	revision := createConfigWithImportedInhibitRules(nil, []config.InhibitRule{importedRule})
	store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
		return revision, nil
	}
	prov.On("GetProvenances", ctx, orgID, models.ResourceTypeInhibitionRule).Return(map[string]models.Provenance{}, nil)

	// Fetch the imported rule to get its actual UID (with matchers added)
	allRules, err := sut.GetInhibitionRules(ctx, orgID)
	require.NoError(t, err)
	require.Len(t, allRules, 1)

	importedRuleWithUID := allRules[0]

	// Try to update it
	_, err = sut.UpdateInhibitionRule(ctx, importedRuleWithUID, orgID)
	require.Error(t, err)
	assert.ErrorIs(t, err, models.ErrInhibitionRuleOrigin)
}

func TestService_DeleteInhibitionRule_RejectsImported(t *testing.T) {
	ctx := context.Background()
	orgID := int64(1)

	importedRule := config.InhibitRule{
		SourceMatchers: config.Matchers{
			{Type: labels.MatchEqual, Name: "alertname", Value: "ImportedAlert"},
		},
		TargetMatchers: config.Matchers{
			{Type: labels.MatchEqual, Name: "alertname", Value: "ImportedTarget"},
		},
		Equal: []string{"cluster"},
	}

	sut, store, prov := createInhibitionRuleSvcSut()
	revision := createConfigWithImportedInhibitRules(nil, []config.InhibitRule{importedRule})
	store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
		return revision, nil
	}
	prov.On("GetProvenances", ctx, orgID, models.ResourceTypeInhibitionRule).Return(map[string]models.Provenance{}, nil)

	// Fetch the imported rule to get its actual UID (with matchers added)
	allRules, err := sut.GetInhibitionRules(ctx, orgID)
	require.NoError(t, err)
	require.Len(t, allRules, 1)

	importedUID := allRules[0].UID

	// Try to delete it
	err = sut.DeleteInhibitionRule(ctx, importedUID, orgID, models.ProvenanceAPI, "")

	require.Error(t, err)
	assert.ErrorIs(t, err, models.ErrInhibitionRuleOrigin)
}

// Test helpers

func createInhibitionRuleSvcSut() (*Service, *legacy_storage.AlertmanagerConfigStoreFake, *MockProvisioningStore) {
	store := &legacy_storage.AlertmanagerConfigStoreFake{}
	prov := &MockProvisioningStore{}
	xact := newNopTransactionManager()
	logger := log.NewNopLogger()
	return NewService(store, prov, xact, logger, true), store, prov
}

func createConfigWithImportedInhibitRules(grafanaRules, importedRules []config.InhibitRule) *legacy_storage.ConfigRevision {
	cfg := &definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				InhibitRules: grafanaRules,
				Route: &definitions.Route{
					Receiver: "default",
				},
			},
		},
		ManagedRoutes: map[string]*definitions.Route{
			"default-route": {Receiver: "default"},
		},
	}

	if len(importedRules) > 0 {
		mimirConfig := buildMimirAMConfigWithInhibitRules(importedRules)
		cfg.ExtraConfigs = []definitions.ExtraConfiguration{
			{
				Identifier:         "test-mimir",
				MergeMatchers:      config.Matchers{&labels.Matcher{Type: labels.MatchEqual, Name: "__imported", Value: "test"}},
				AlertmanagerConfig: mimirConfig,
			},
		}
	}

	return &legacy_storage.ConfigRevision{Config: cfg}
}

func buildMimirAMConfigWithInhibitRules(rules []config.InhibitRule) string {
	// Build a minimal Alertmanager config YAML with inhibition rules
	yaml := `route:
  receiver: default
receivers:
  - name: default
inhibit_rules:
`
	for _, rule := range rules {
		yaml += "  - source_matchers:\n"
		for _, m := range rule.SourceMatchers {
			yaml += "      - " + m.String() + "\n"
		}
		yaml += "    target_matchers:\n"
		for _, m := range rule.TargetMatchers {
			yaml += "      - " + m.String() + "\n"
		}
		if len(rule.Equal) > 0 {
			yaml += "    equal:\n"
			for _, e := range rule.Equal {
				yaml += "      - " + e + "\n"
			}
		}
	}
	return yaml
}
