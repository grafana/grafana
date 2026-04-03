package notifier

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/client_golang/prometheus"
	prommodel "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func setupAMTest(t *testing.T) *alertmanager {
	dir := t.TempDir()
	cfg := &setting.Cfg{
		DataPath: dir,
		AppURL:   "http://localhost:9093",
	}

	l := log.New("alertmanager-test")

	m := metrics.NewAlertmanagerMetrics(prometheus.NewRegistry(), l)
	sqlStore := db.InitTestDB(t)
	s := &store.DBstore{
		Cfg: setting.UnifiedAlertingSettings{
			BaseInterval:                  10 * time.Second,
			DefaultRuleEvaluationInterval: time.Minute,
		},
		SQLStore:         sqlStore,
		Logger:           l,
		DashboardService: dashboards.NewFakeDashboardService(t),
	}

	kvStore := fakes.NewFakeKVStore(t)
	secretsService := secretsManager.SetupTestService(t, database.ProvideSecretsStore(sqlStore))
	decryptFn := secretsService.GetDecryptedValue

	orgID := 1
	stateStore := NewFileStore(int64(orgID), kvStore)
	crypto := NewCrypto(secretsService, s, l)

	am, err := NewAlertmanager(context.Background(), 1, cfg, s, stateStore, &NilPeer{}, decryptFn, nil, m, featuremgmt.WithFeatures(), crypto, nil)
	require.NoError(t, err)
	return am
}

func TestIntegrationAlertmanager_newAlertmanager(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	am := setupAMTest(t)
	require.False(t, am.Ready())
}

func TestAlertmanager_SaveAndApplyExtraConfiguration_WithExternalSecrets(t *testing.T) {
	moa := NewTestMultiOrgAlertmanager(t)
	am, err := moa.AlertmanagerFor(1)
	require.NoError(t, err)

	cfg := &definitions.PostableUserConfig{
		AlertmanagerConfig: definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				Route: &definitions.Route{
					Receiver: "default-receiver",
				},
			},
			Receivers: []*definitions.PostableApiReceiver{
				{
					Receiver: definitions.Receiver{Name: "default-receiver"},
				},
			},
		},
	}

	err = moa.saveAndApplyConfig(context.Background(), 1, am, cfg)
	require.NoError(t, err)

	_, err = moa.SaveAndApplyExtraConfiguration(context.Background(), 1, definitions.ExtraConfiguration{
		Identifier:    "external-prometheus",
		MergeMatchers: []*labels.Matcher{{Type: labels.MatchEqual, Name: "cluster", Value: "prod"}},
		AlertmanagerConfig: `
route:
  receiver: webhook-receiver
receivers:
  - name: webhook-receiver
    webhook_configs:
      - url: 'https://webhook.example.com/alerts'
        http_config:
          basic_auth:
            username: 'admin'
            password: 'super-secret-password'
      - url: 'https://slack.com/webhook/ABC123'
        send_resolved: true
  - name: email-receiver
    email_configs:
      - to: 'alerts@example.com'
        from: 'grafana@example.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'grafana@example.com'
        auth_password: 'another-secret-password'`,
	}, false, false)
	require.NoError(t, err)

	savedConfig, err := moa.configStore.GetLatestAlertmanagerConfiguration(context.Background(), am.(*alertmanager).Base.TenantID())
	require.NoError(t, err)

	// Verify secrets are encrypted in stored config
	var savedUserConfig definitions.PostableUserConfig
	err = json.Unmarshal([]byte(savedConfig.AlertmanagerConfiguration), &savedUserConfig)
	require.NoError(t, err)

	require.Len(t, savedUserConfig.ExtraConfigs, 1)
	extraConfig := savedUserConfig.ExtraConfigs[0]

	require.Equal(t, "external-prometheus", extraConfig.Identifier)
	require.NotContains(t, extraConfig.AlertmanagerConfig, "super-secret-password")
	require.NotContains(t, extraConfig.AlertmanagerConfig, "another-secret-password")
	require.NotContains(t, extraConfig.AlertmanagerConfig, "ABC123")

	// Apply the saved configuration again and check that it is applied without errors
	changed, err := moa.ApplyConfig(context.Background(), 1, savedConfig)
	require.NoError(t, err)
	require.False(t, changed) // No errors, but the config has not changed.
	require.True(t, am.Ready())
}

func TestAlertmanager_ApplyConfig(t *testing.T) {
	basicConfig := func() definitions.PostableApiAlertingConfig {
		return definitions.PostableApiAlertingConfig{
			Config: definitions.Config{
				Route: &definitions.Route{
					Receiver: "default-receiver",
				},
			},
			Receivers: []*definitions.PostableApiReceiver{
				{
					Receiver: definitions.Receiver{
						Name: "default-receiver",
					},
				},
			},
		}
	}

	testCases := []struct {
		name          string
		config        *definitions.PostableUserConfig
		expectedError string
		skipInvalid   bool
	}{
		{
			name: "basic config",
			config: &definitions.PostableUserConfig{
				AlertmanagerConfig: basicConfig(),
				TemplateFiles: map[string]string{
					"grafana-template": "{{ define \"grafana.title\" }}Alert{{ end }}",
				},
			},
			skipInvalid: false,
		},
		{
			name: "with mimir config",
			config: &definitions.PostableUserConfig{
				AlertmanagerConfig: basicConfig(),
				TemplateFiles: map[string]string{
					"grafana-template": "{{ define \"grafana.title\" }}Grafana Alert{{ end }}",
				},
				ExtraConfigs: []definitions.ExtraConfiguration{
					{
						Identifier: "mimir-prod",
						MergeMatchers: config.Matchers{
							{
								Type:  labels.MatchEqual,
								Name:  "__mimir__",
								Value: "true",
							},
						},
						TemplateFiles: map[string]string{
							"mimir-template": "{{ define \"mimir.title\" }}Mimir Alert{{ end }}",
						},
						AlertmanagerConfig: `route:
  receiver: mimir-webhook
  group_by:
    - alertname
    - cluster
receivers:
  - name: mimir-webhook
    webhook_configs:
      - url: https://webhook.example.com/alerts
        send_resolved: true
        http_config: {}`,
					},
				},
			},
			skipInvalid: false,
		},
		{
			name: "invalid config fails",
			config: &definitions.PostableUserConfig{
				AlertmanagerConfig: basicConfig(),
				ExtraConfigs: []definitions.ExtraConfiguration{
					{
						Identifier:    "", // invalid: empty identifier
						MergeMatchers: config.Matchers{},
						AlertmanagerConfig: `route:
  receiver: test-receiver
receivers:
  - name: test-receiver`,
					},
				},
			},
			expectedError: "failed to get full alertmanager configuration",
			skipInvalid:   false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			moa := NewTestMultiOrgAlertmanager(t)
			am, err := moa.AlertmanagerFor(1)
			require.NoError(t, err)
			ctx := context.Background()

			err = moa.saveAndApplyConfig(ctx, 1, am, tc.config)

			if tc.expectedError != "" {
				require.Error(t, err)
				require.ErrorContains(t, err, tc.expectedError)
			} else {
				require.NoError(t, err)

				templateDefs := tc.config.GetMergedTemplateDefinitions()
				expectedTemplateCount := len(tc.config.TemplateFiles)
				if len(tc.config.ExtraConfigs) > 0 {
					expectedTemplateCount += len(tc.config.ExtraConfigs[0].TemplateFiles)
				}
				require.Len(t, templateDefs, expectedTemplateCount)
			}
		})
	}
}

func TestAlertmanager_HashStabilityAndChangeDetection(t *testing.T) {
	baseConfig := func(receivers ...string) *definitions.PostableUserConfig {
		postableReceivers := make([]*definitions.PostableApiReceiver, 0, len(receivers))
		for _, r := range receivers {
			postableReceivers = append(postableReceivers, &definitions.PostableApiReceiver{
				Receiver: definitions.Receiver{Name: r},
			})
		}
		return &definitions.PostableUserConfig{
			TemplateFiles: map[string]string{
				"a-template.tmpl": "{{ define \"a\" }}a{{ end }}",
				"b-template.tmpl": "{{ define \"b\" }}b{{ end }}",
			},
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: receivers[0]},
				},
				Receivers: postableReceivers,
			},
		}
	}

	matcher := func(name, value string) *labels.Matcher {
		m, err := labels.NewMatcher(labels.MatchEqual, name, value)
		require.NoError(t, err)
		return m
	}

	toDBConfig := func(t *testing.T, cfg *definitions.PostableUserConfig) *ngmodels.AlertConfiguration {
		t.Helper()
		raw, err := json.Marshal(&cfg)
		require.NoError(t, err)
		return &ngmodels.AlertConfiguration{AlertmanagerConfiguration: string(raw)}
	}

	type testCase struct {
		name            string
		features        featuremgmt.FeatureToggles
		initialConfig   func() *definitions.PostableUserConfig
		initialSettings map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting
		mutate          func(cfg *definitions.PostableUserConfig, settings map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting)
	}

	testCases := []testCase{
		{
			name:     "Basic config without changes is stable",
			features: featuremgmt.WithFeatures(),
			initialConfig: func() *definitions.PostableUserConfig {
				return baseConfig("default-receiver", "extra-receiver")
			},
		},
		{
			name:     "Route config changes affect hash",
			features: featuremgmt.WithFeatures(),
			initialConfig: func() *definitions.PostableUserConfig {
				return baseConfig("default-receiver", "extra-receiver")
			},
			mutate: func(cfg *definitions.PostableUserConfig, _ map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting) {
				cfg.AlertmanagerConfig.Route.GroupByStr = []string{"cluster"}
			},
		},
		{
			name:     "Template config changes affect hash",
			features: featuremgmt.WithFeatures(),
			initialConfig: func() *definitions.PostableUserConfig {
				return baseConfig("default-receiver", "extra-receiver")
			},
			mutate: func(cfg *definitions.PostableUserConfig, _ map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting) {
				cfg.TemplateFiles["new.tmpl"] = "{{ define \"new\" }}b{{ end }}"
			},
		},
		{
			name:     "Receiver config changes affect hash",
			features: featuremgmt.WithFeatures(),
			initialConfig: func() *definitions.PostableUserConfig {
				return baseConfig("default-receiver", "extra-receiver")
			},
			mutate: func(cfg *definitions.PostableUserConfig, _ map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting) {
				cfg.AlertmanagerConfig.Receivers = append(cfg.AlertmanagerConfig.Receivers, &definitions.PostableApiReceiver{
					Receiver: definitions.Receiver{Name: "new-receiver"},
				})
			},
		},
		{
			name:     "extra config changes affect hash",
			features: featuremgmt.WithFeatures(),
			initialConfig: func() *definitions.PostableUserConfig {
				cfg := baseConfig("default-receiver", "extra-receiver")
				cfg.ExtraConfigs = []definitions.ExtraConfiguration{
					{
						Identifier: "mimir-prod",
						MergeMatchers: definitions.Matchers{
							matcher("cluster", "prod"),
							matcher("source", "external"),
						},
						TemplateFiles: map[string]string{
							"extra-b.tmpl": "{{ define \"extra.b\" }}b{{ end }}",
							"extra-a.tmpl": "{{ define \"extra.a\" }}a{{ end }}",
						},
						AlertmanagerConfig: `route:
  receiver: extra-receiver
receivers:
  - name: extra-receiver`,
					},
				}
				return cfg
			},
			mutate: func(cfg *definitions.PostableUserConfig, _ map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting) {
				cfg.ExtraConfigs[0].MergeMatchers[0].Value = "staging"
			},
		},
		{
			name:     "managed routes changes affect hash",
			features: featuremgmt.WithFeatures(featuremgmt.FlagAlertingMultiplePolicies),
			initialConfig: func() *definitions.PostableUserConfig {
				cfg := baseConfig("default-receiver", "team-a", "team-b", "team-c")
				cfg.ManagedRoutes = definitions.ManagedRoutes{
					"team-b-policy": {Receiver: "team-b"},
					"team-a-policy": {Receiver: "team-a"},
				}
				return cfg
			},
			mutate: func(cfg *definitions.PostableUserConfig, _ map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting) {
				cfg.ManagedRoutes["team-c-policy"] = &definitions.Route{Receiver: "team-c"}
			},
		},
		{
			name:     "managed inhibition rule changes affect hash",
			features: featuremgmt.WithFeatures(featuremgmt.FlagAlertingMultiplePolicies),
			initialConfig: func() *definitions.PostableUserConfig {
				cfg := baseConfig("default-receiver", "team-receiver")
				cfg.ManagedInhibitionRules = definitions.ManagedInhibitionRules{
					"suppress-warning-when-critical": {
						Name: "suppress-warning-when-critical",
						InhibitRule: definitions.InhibitRule{
							SourceMatchers: []*labels.Matcher{matcher("severity", "critical")},
							TargetMatchers: []*labels.Matcher{matcher("severity", "warning")},
							Equal:          []string{"alertname", "cluster"},
						},
					},
				}
				return cfg
			},
			mutate: func(cfg *definitions.PostableUserConfig, _ map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting) {
				cfg.ManagedInhibitionRules["suppress-warning-when-critical"].Equal = []string{"alertname", "cluster", "namespace"}
			},
		},
		{
			name:     "autogenerated routes from rule contact point routing change hash",
			features: featuremgmt.WithFeatures(),
			initialConfig: func() *definitions.PostableUserConfig {
				return baseConfig("default-receiver", "receiver-1")
			},
			initialSettings: map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting{
				{OrgID: 1, UID: "rule-b"}: {
					Receiver:  "receiver-1",
					GroupWait: util.Pointer(prommodel.Duration(1 * time.Minute)),
				},
				{OrgID: 1, UID: "rule-a"}: {
					Receiver:      "receiver-1",
					GroupInterval: util.Pointer(prommodel.Duration(2 * time.Minute)),
				},
			},
			mutate: func(_ *definitions.PostableUserConfig, settings map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting) {
				settings[ngmodels.AlertRuleKey{OrgID: 1, UID: "rule-b"}] = ngmodels.ContactPointRouting{
					Receiver:  "receiver-1",
					GroupWait: util.Pointer(prommodel.Duration(3 * time.Minute)),
				}
			},
		},
		{
			name:     "extra config with v0mimir email config",
			features: featuremgmt.WithFeatures(),
			initialConfig: func() *definitions.PostableUserConfig {
				cfg := baseConfig("default-receiver", "extra-receiver")
				cfg.ExtraConfigs = []definitions.ExtraConfiguration{
					{
						Identifier: "mimir-prod",
						MergeMatchers: definitions.Matchers{
							matcher("cluster", "prod"),
							matcher("source", "external"),
						},
						TemplateFiles: map[string]string{
							"extra-b.tmpl": "{{ define \"extra.b\" }}b{{ end }}",
							"extra-a.tmpl": "{{ define \"extra.a\" }}a{{ end }}",
						},
						AlertmanagerConfig: `route:
  receiver: extra-receiver
receivers:
  - name: extra-receiver
    email_configs:
      - to: 'alerts@example.com'
        from: 'grafana@example.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'grafana@example.com'
        auth_password: 'another-secret-password'`,
					},
				}
				return cfg
			},
			mutate: func(cfg *definitions.PostableUserConfig, _ map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting) {
				cfg.ExtraConfigs[0].MergeMatchers[0].Value = "staging"
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()

			s := NewFakeConfigStore(t, map[int64]*ngmodels.AlertConfiguration{})
			s.notificationSettings = map[int64]map[ngmodels.AlertRuleKey]ngmodels.ContactPointRouting{
				1: tc.initialSettings,
			}

			moa := NewTestMultiOrgAlertmanager(t, WithConfigStore(s), WithFeatureToggles(tc.features))
			am, err := moa.AlertmanagerFor(1)
			require.NoError(t, err)
			base := am.(*alertmanager).Base

			changed, err := moa.ApplyConfig(ctx, 1, toDBConfig(t, tc.initialConfig()))
			require.NoError(t, err)
			require.True(t, changed)

			firstHash := am.(*alertmanager).appliedHash
			firstApplied := base.AppliedConfig()
			for i := 0; i < 20; i++ {
				changed, err = moa.ApplyConfig(ctx, 1, toDBConfig(t, tc.initialConfig()))
				require.NoError(t, err)
				diff := cmp.Diff(firstApplied, base.AppliedConfig(), cmpopts.IgnoreUnexported(definition.Route{}, labels.Matcher{}))
				if diff != "" {
					t.Errorf("Unexpected change in applied config: %v", diff)
				}
				require.Falsef(t, changed, "applyConfig should not return changed=true after first run, diff:\n%s", diff)
				require.Equal(t, firstHash, am.(*alertmanager).appliedHash)
			}

			if tc.mutate == nil {
				return
			}
			mutatedCfg := tc.initialConfig()
			tc.mutate(mutatedCfg, tc.initialSettings)

			changed, err = moa.ApplyConfig(ctx, 1, toDBConfig(t, mutatedCfg))
			require.NoError(t, err)
			require.True(t, changed)
			require.NotEqual(t, firstHash, am.(*alertmanager).appliedHash)

			mutatedCfg = tc.initialConfig()
			tc.mutate(mutatedCfg, tc.initialSettings)

			updatedHash := am.(*alertmanager).appliedHash
			updatedApplied := base.AppliedConfig()
			changed, err = moa.ApplyConfig(ctx, 1, toDBConfig(t, mutatedCfg))
			require.NoError(t, err)
			diff := cmp.Diff(updatedApplied, base.AppliedConfig(), cmpopts.IgnoreUnexported(definition.Route{}, labels.Matcher{}))
			if diff != "" {
				t.Errorf("Unexpected change in applied config: %v", diff)
			}
			require.Falsef(t, changed, "applyConfig should not return changed=true after second mutated update, diff:\n%s", diff)
			require.Equal(t, updatedHash, am.(*alertmanager).appliedHash)
		})
	}
}
