package api

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	ngfakes "github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestContextWithTimeoutFromRequest(t *testing.T) {
	t.Run("assert context has default timeout when header is absent", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(t, err)

		now := time.Now()
		ctx := context.Background()
		ctx, cancelFunc, err := contextWithTimeoutFromRequest(
			ctx,
			req,
			15*time.Second,
			30*time.Second)
		require.NoError(t, err)
		require.NotNil(t, cancelFunc)
		require.NotNil(t, ctx)

		deadline, ok := ctx.Deadline()
		require.True(t, ok)
		require.True(t, deadline.After(now))
		require.Less(t, deadline.Sub(now).Seconds(), 30.0)
		require.GreaterOrEqual(t, deadline.Sub(now).Seconds(), 15.0)
	})

	t.Run("assert context has timeout in request header", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(t, err)
		req.Header.Set("Request-Timeout", "5")

		now := time.Now()
		ctx := context.Background()
		ctx, cancelFunc, err := contextWithTimeoutFromRequest(
			ctx,
			req,
			15*time.Second,
			30*time.Second)
		require.NoError(t, err)
		require.NotNil(t, cancelFunc)
		require.NotNil(t, ctx)

		deadline, ok := ctx.Deadline()
		require.True(t, ok)
		require.True(t, deadline.After(now))
		require.Less(t, deadline.Sub(now).Seconds(), 15.0)
		require.GreaterOrEqual(t, deadline.Sub(now).Seconds(), 5.0)
	})

	t.Run("assert timeout in request header cannot exceed max timeout", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(t, err)
		req.Header.Set("Request-Timeout", "60")

		ctx := context.Background()
		ctx, cancelFunc, err := contextWithTimeoutFromRequest(
			ctx,
			req,
			15*time.Second,
			30*time.Second)
		require.Error(t, err, "exceeded maximum timeout")
		require.Nil(t, cancelFunc)
		require.Nil(t, ctx)
	})
}

func TestAlertmanagerConfig(t *testing.T) {
	t.Run("when objects are not provisioned", func(t *testing.T) {
		t.Run("route from GET config has no provenance", func(t *testing.T) {
			sut := createSut(t)
			rc := createRequestCtxInOrg(1)

			response := sut.RouteGetAlertingConfig(rc)

			body := asGettableUserConfig(t, response)
			require.Equal(t, apimodels.Provenance(ngmodels.ProvenanceNone), body.AlertmanagerConfig.Route.Provenance)
		})
		t.Run("contact point from GET config has no provenance", func(t *testing.T) {
			sut := createSut(t)
			rc := createRequestCtxInOrg(1)

			response := sut.RouteGetAlertingConfig(rc)

			body := asGettableUserConfig(t, response)
			require.Equal(t, apimodels.Provenance(ngmodels.ProvenanceNone), body.AlertmanagerConfig.Receivers[0].GrafanaManagedReceivers[0].Provenance)
		})
		t.Run("templates from GET config have no provenance", func(t *testing.T) {
			sut := createSut(t)
			rc := createRequestCtxInOrg(1)

			response := sut.RouteGetAlertingConfig(rc)

			body := asGettableUserConfig(t, response)
			require.Nil(t, body.TemplateFileProvenances)
		})
	})

	t.Run("when objects are provisioned", func(t *testing.T) {
		t.Run("route from GET config has expected provenance", func(t *testing.T) {
			sut := createSut(t)
			rc := createRequestCtxInOrg(1)
			setRouteProvenance(t, 1, sut.mam.ProvStore)

			response := sut.RouteGetAlertingConfig(rc)

			body := asGettableUserConfig(t, response)
			require.Equal(t, apimodels.Provenance(ngmodels.ProvenanceAPI), body.AlertmanagerConfig.Route.Provenance)
		})
		t.Run("contact point from GET config has expected provenance", func(t *testing.T) {
			sut := createSut(t)
			rc := createRequestCtxInOrg(1)

			RoutePostAlertingConfig(t, sut.mam, rc, validConfig)

			response := sut.RouteGetAlertingConfig(rc)
			body := asGettableUserConfig(t, response)

			cpUID := body.AlertmanagerConfig.Receivers[0].GrafanaManagedReceivers[0].UID
			require.NotEmpty(t, cpUID)

			setContactPointProvenance(t, 1, cpUID, sut.mam.ProvStore)

			response = sut.RouteGetAlertingConfig(rc)
			body = asGettableUserConfig(t, response)

			require.Equal(t, apimodels.Provenance(ngmodels.ProvenanceAPI), body.AlertmanagerConfig.Receivers[0].GrafanaManagedReceivers[0].Provenance)
		})
		t.Run("templates from GET config have expected provenance", func(t *testing.T) {
			sut := createSut(t)
			rc := createRequestCtxInOrg(1)
			setTemplateProvenance(t, 1, "a", sut.mam.ProvStore)

			response := sut.RouteGetAlertingConfig(rc)

			body := asGettableUserConfig(t, response)
			require.NotNil(t, body.TemplateFileProvenances)
			require.Len(t, body.TemplateFileProvenances, 1)
			require.Equal(t, apimodels.Provenance(ngmodels.ProvenanceAPI), body.TemplateFileProvenances["a"])
		})
	})
}

func TestGetAlertmanagerConfiguration_NewSecretField(t *testing.T) {
	// This test has the following goals:
	// Given:
	// - A saved notifier config with an existing secret field stored unencrypted in Settings.
	// Ensure:
	// - The secret field is not returned in plaintext.
	// - The secret field is returned as a bool in SecureFields.
	// - The secret field is correctly saved and encrypted in SecureSettings when saving the notifier config without changes.
	// - The secret field is removed from Settings when saving the notifier config.

	sut := createSut(t)
	orgId := int64(1)

	// This config has the secret field "integrationKey" stored incorrectly and unencrypted in Settings.
	configs := map[int64]*ngmodels.AlertConfiguration{
		1: {
			OrgID: orgId,
			AlertmanagerConfiguration: `{
	"alertmanager_config": {
		"route": {
			"receiver": "configWithNewlySecretSetting"
		},
		"receivers": [{
			"name": "configWithNewlySecretSetting",
			"grafana_managed_receiver_configs": [{
				"uid": "configWithNewlySecretSetting-uid",
				"name": "configWithNewlySecretSetting",
				"type": "pagerduty",
				"settings": {"integrationKey": "unencrypted secure secret"},
				"secureSettings": {}
			}]
		}]
	}
}
`,
			CreatedAt: time.Now().Unix(),
			Default:   false,
		},
	}

	// Store the config as-is in the database. Bypasses normal save route so it doesn't get pre-emptively fixed.
	mam := createMultiOrgAlertmanager(t, configs)
	sut.mam = mam

	rc := createRequestCtxInOrg(orgId)
	res := sut.RouteGetAlertingConfig(rc)
	gettable := asGettableUserConfig(t, res)

	integration := gettable.GetGrafanaReceiverMap()["configWithNewlySecretSetting-uid"]
	require.NotNil(t, integration)

	var settings map[string]string
	err := json.Unmarshal(integration.Settings, &settings)
	require.NoError(t, err)

	// The secret field "integrationKey" should not be returned in plaintext.
	assert.NotEqual(t, "unencrypted secure secret", settings["integrationKey"])
	// Just in case let's look for the unencrypted value anywhere in the settings.
	assert.NotContains(t, string(integration.Settings), "unencrypted")

	// The secret fields should be returned as a bool in SecureFields.
	assert.True(t, integration.SecureFields["integrationKey"])

	// Now we save the config without changes. This should encrypt the field "integrationKey" into SecureSettings and
	// remove it from Settings.

	// Simulates FE-API interaction, "integrationKey" is not sent in Settings as the caller.
	// Instead, it leaves it out of "SecureSettings" to indicate the API should keep the existing value.
	postWithoutChanges := `{
	"alertmanager_config": {
		"route": {
			"receiver": "configWithNewlySecretSetting"
		},
		"receivers": [{
			"name": "configWithNewlySecretSetting",
			"grafana_managed_receiver_configs": [{
				"uid": "configWithNewlySecretSetting-uid",
				"name": "configWithNewlySecretSetting",
				"type": "pagerduty",
				"settings": {},
				"secureSettings": {}
			}]
		}]
	}
}
`

	RoutePostAlertingConfig(t, sut.mam, rc, postWithoutChanges)
	// Check that the secret field "integrationKey" is now encrypted in SecureSettings.
	savedConfig := &apimodels.PostableUserConfig{}
	err = json.Unmarshal([]byte(configs[orgId].AlertmanagerConfiguration), savedConfig)
	require.NoError(t, err)

	savedIntegration := savedConfig.GetGrafanaReceiverMap()["configWithNewlySecretSetting-uid"]
	require.NotNil(t, savedIntegration)

	// No longer in Settings.
	assert.Equal(t, "{}", string(savedIntegration.Settings))

	// Encrypted in SecureSettings.
	secureSecret := savedIntegration.SecureSettings["integrationKey"]
	assert.NotEmpty(t, secureSecret)
	encryptedSecret, err := base64.StdEncoding.DecodeString(secureSecret)
	require.NoError(t, err)

	// No access to .Decrypt, but we can check that it's not the same as the unencrypted value.
	assert.NotEqual(t, "unencrypted secure secret", string(encryptedSecret))
}

func TestAlertmanagerAutogenConfig(t *testing.T) {
	createSutForAutogen := func(t *testing.T) (AlertmanagerSrv, map[int64]*ngmodels.AlertConfiguration) {
		sut := createSut(t)
		configs := map[int64]*ngmodels.AlertConfiguration{
			1: {AlertmanagerConfiguration: validConfig, OrgID: 1},
			2: {AlertmanagerConfiguration: validConfigWithoutAutogen, OrgID: 2},
		}
		sut.mam = createMultiOrgAlertmanager(t, configs)
		return sut, configs
	}

	compare := func(t *testing.T, expectedAm string, testAm string) {
		test, err := notifier.Load([]byte(testAm))
		require.NoError(t, err)

		exp, err := notifier.Load([]byte(expectedAm))
		require.NoError(t, err)

		cOpt := []cmp.Option{
			cmpopts.IgnoreUnexported(apimodels.PostableUserConfig{}, apimodels.Route{}, labels.Matcher{}),
			cmpopts.IgnoreFields(apimodels.PostableGrafanaReceiver{}, "UID", "Settings"),
		}
		if !cmp.Equal(test, exp, cOpt...) {
			t.Errorf("Unexpected AM Config: %v", cmp.Diff(test, exp, cOpt...))
		}
	}

	t.Run("route GET config", func(t *testing.T) {
		t.Run("when admin return autogen routes", func(t *testing.T) {
			sut, _ := createSutForAutogen(t)

			rc := createRequestCtxInOrg(2)
			rc.OrgRole = org.RoleAdmin

			response := sut.RouteGetAlertingConfig(rc)
			require.Equal(t, 200, response.Status())

			compare(t, validConfigWithAutogen, string(response.Body()))
		})

		t.Run("when not admin return no autogen routes", func(t *testing.T) {
			sut, _ := createSutForAutogen(t)

			rc := createRequestCtxInOrg(2)

			response := sut.RouteGetAlertingConfig(rc)
			require.Equal(t, 200, response.Status())

			compare(t, validConfigWithoutAutogen, string(response.Body()))
		})
	})

	t.Run("route GET status", func(t *testing.T) {
		t.Run("when admin return autogen routes", func(t *testing.T) {
			sut, _ := createSutForAutogen(t)

			rc := createRequestCtxInOrg(2)
			rc.OrgRole = org.RoleAdmin

			response := sut.RouteGetAMStatus(rc)
			require.Equal(t, 200, response.Status())

			var status struct {
				Config apimodels.PostableApiAlertingConfig `json:"config"`
			}
			err := json.Unmarshal(response.Body(), &status)
			require.NoError(t, err)
			configBody, err := json.Marshal(apimodels.PostableUserConfig{
				TemplateFiles:      map[string]string{"a": "template"},
				AlertmanagerConfig: status.Config,
			})
			require.NoError(t, err)

			compare(t, validConfigWithAutogen, string(configBody))
		})

		t.Run("when not admin return no autogen routes", func(t *testing.T) {
			sut, _ := createSutForAutogen(t)

			rc := createRequestCtxInOrg(2)

			response := sut.RouteGetAMStatus(rc)
			require.Equal(t, 200, response.Status())

			var status struct {
				Config apimodels.PostableApiAlertingConfig `json:"config"`
			}
			err := json.Unmarshal(response.Body(), &status)
			require.NoError(t, err)
			configBody, err := json.Marshal(apimodels.PostableUserConfig{
				TemplateFiles:      map[string]string{"a": "template"},
				AlertmanagerConfig: status.Config,
			})
			require.NoError(t, err)

			compare(t, validConfigWithoutAutogen, string(configBody))
		})
	})
}

func TestRouteGetAlertingConfigHistory(t *testing.T) {
	sut := createSut(t)

	t.Run("assert 200 and empty slice when no applied configurations are found", func(tt *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(tt, err)
		q := req.URL.Query()
		q.Add("limit", "10")
		req.URL.RawQuery = q.Encode()

		rc := createRequestCtxInOrg(10)

		response := sut.RouteGetAlertingConfigHistory(rc)
		require.Equal(tt, 200, response.Status())

		var configs []apimodels.GettableHistoricUserConfig
		err = json.Unmarshal(response.Body(), &configs)
		require.NoError(tt, err)

		require.Len(tt, configs, 0)
	})

	t.Run("assert 200 and one config in the response for an org that has one successfully applied configuration", func(tt *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(tt, err)
		q := req.URL.Query()
		q.Add("limit", "10")
		req.URL.RawQuery = q.Encode()

		rc := createRequestCtxInOrg(1)

		response := sut.RouteGetAlertingConfigHistory(rc)
		require.Equal(tt, 200, response.Status())

		var configs []apimodels.GettableHistoricUserConfig
		err = json.Unmarshal(response.Body(), &configs)
		require.NoError(tt, err)

		require.Len(tt, configs, 1)
	})

	t.Run("assert 200 when no limit is provided", func(tt *testing.T) {
		rc := createRequestCtxInOrg(1)

		response := sut.RouteGetAlertingConfigHistory(rc)
		require.Equal(tt, 200, response.Status())

		configs := asGettableHistoricUserConfigs(tt, response)
		for _, config := range configs {
			require.NotZero(tt, config.LastApplied)
		}
	})

	t.Run("assert 200 when limit is < 1", func(tt *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(tt, err)
		q := req.URL.Query()
		q.Add("limit", "0")
		req.URL.RawQuery = q.Encode()

		rc := createRequestCtxInOrg(1)

		response := sut.RouteGetAlertingConfigHistory(rc)
		require.Equal(tt, 200, response.Status())

		configs := asGettableHistoricUserConfigs(tt, response)
		for _, config := range configs {
			require.NotZero(tt, config.LastApplied)
		}
	})

	t.Run("assert 200 when limit is > 100", func(tt *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(tt, err)
		q := req.URL.Query()
		q.Add("limit", "1000")
		req.URL.RawQuery = q.Encode()

		rc := createRequestCtxInOrg(1)

		response := sut.RouteGetAlertingConfigHistory(rc)
		require.Equal(tt, 200, response.Status())

		configs := asGettableHistoricUserConfigs(tt, response)
		for _, config := range configs {
			require.NotZero(tt, config.LastApplied)
		}
	})
}

func TestRoutePostGrafanaAlertingConfigHistoryActivate(t *testing.T) {
	sut := createSut(t)

	t.Run("assert 404 when no historical configurations are found", func(tt *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(tt, err)
		q := req.URL.Query()
		req.URL.RawQuery = q.Encode()

		rc := createRequestCtxInOrg(10)

		response := sut.RoutePostGrafanaAlertingConfigHistoryActivate(rc, "0")
		require.Equal(tt, 404, response.Status())
	})

	t.Run("assert 202 for a valid org and id", func(tt *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(tt, err)
		q := req.URL.Query()
		req.URL.RawQuery = q.Encode()

		rc := createRequestCtxInOrg(1)

		response := sut.RoutePostGrafanaAlertingConfigHistoryActivate(rc, "0")
		require.Equal(tt, 202, response.Status())
	})

	t.Run("assert 400 when id is not parseable", func(tt *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(tt, err)
		q := req.URL.Query()
		req.URL.RawQuery = q.Encode()

		rc := createRequestCtxInOrg(1)

		response := sut.RoutePostGrafanaAlertingConfigHistoryActivate(rc, "abc")
		require.Equal(tt, 400, response.Status())
	})
}

func TestRoutePostTestTemplates(t *testing.T) {
	sut := createSut(t)

	t.Run("assert 404 when no alertmanager found", func(tt *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(tt, err)
		q := req.URL.Query()
		req.URL.RawQuery = q.Encode()

		rc := createRequestCtxInOrg(10)

		response := sut.RoutePostTestTemplates(rc, apimodels.TestTemplatesConfigBodyParams{})
		require.Equal(tt, 404, response.Status())
	})

	t.Run("assert 409 when alertmanager not ready", func(tt *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(tt, err)
		q := req.URL.Query()
		req.URL.RawQuery = q.Encode()

		rc := createRequestCtxInOrg(3)

		response := sut.RoutePostTestTemplates(rc, apimodels.TestTemplatesConfigBodyParams{})
		require.Equal(tt, 409, response.Status())
	})

	t.Run("assert 200 for a valid alertmanager", func(tt *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "https://grafana.net", nil)
		require.NoError(tt, err)
		q := req.URL.Query()
		req.URL.RawQuery = q.Encode()

		rc := createRequestCtxInOrg(1)

		response := sut.RoutePostTestTemplates(rc, apimodels.TestTemplatesConfigBodyParams{})
		require.Equal(tt, 200, response.Status())
	})
}

func createSut(t *testing.T) AlertmanagerSrv {
	t.Helper()

	configs := map[int64]*ngmodels.AlertConfiguration{
		1: {AlertmanagerConfiguration: validConfig, OrgID: 1},
		2: {AlertmanagerConfiguration: validConfig, OrgID: 2},
		3: {AlertmanagerConfiguration: brokenConfig, OrgID: 3},
	}
	mam := createMultiOrgAlertmanager(t, configs)
	log := log.NewNopLogger()
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
	ruleStore := ngfakes.NewRuleStore(t)
	ruleAuthzService := accesscontrol.NewRuleService(acimpl.ProvideAccessControl(featuremgmt.WithFeatures()))
	return AlertmanagerSrv{
		mam:            mam,
		crypto:         mam.Crypto,
		ac:             ac,
		log:            log,
		featureManager: featuremgmt.WithFeatures(),
		silenceSvc:     notifier.NewSilenceService(accesscontrol.NewSilenceService(ac, ruleStore), ruleStore, log, mam, ruleStore, ruleAuthzService),
	}
}

func createMultiOrgAlertmanager(t *testing.T, configs map[int64]*ngmodels.AlertConfiguration) *notifier.MultiOrgAlertmanager {
	t.Helper()

	configStore := notifier.NewFakeConfigStore(t, configs)
	orgStore := notifier.NewFakeOrgStore(t, []int64{1, 2, 3})
	provStore := ngfakes.NewFakeProvisioningStore()
	tmpDir := t.TempDir()
	kvStore := ngfakes.NewFakeKVStore(t)
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	reg := prometheus.NewPedanticRegistry()
	m := metrics.NewNGAlert(reg)
	decryptFn := secretsService.GetDecryptedValue
	cfg := &setting.Cfg{
		DataPath: tmpDir,
		UnifiedAlerting: setting.UnifiedAlertingSettings{
			AlertmanagerConfigPollInterval: 3 * time.Minute,
			DefaultConfiguration:           setting.GetAlertmanagerDefaultConfiguration(),
			DisabledOrgs:                   map[int64]struct{}{5: {}},
		}, // do not poll in tests.
	}

	mam, err := notifier.NewMultiOrgAlertmanager(
		setting.ProvideService(cfg),
		configStore,
		orgStore,
		kvStore,
		provStore,
		decryptFn,
		m.GetMultiOrgAlertmanagerMetrics(),
		nil,
		ngfakes.NewFakeReceiverPermissionsService(),
		log.New("testlogger"),
		secretsService,
		featuremgmt.WithManager(),
		nil,
	)
	require.NoError(t, err)
	err = mam.LoadAndSyncAlertmanagersForOrgs(context.Background())
	require.NoError(t, err)
	return mam
}

var validConfig = `{
	"template_files": {
		"a": "template"
	},
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email"
		},
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "",
				"name": "email receiver",
				"type": "email",
				"settings": {
					"addresses": "<example@email.com>"
				}
			}]
		}]
	}
}
`

var validConfigWithoutAutogen = `{
	"template_files": {
		"a": "template"
	},
	"alertmanager_config": {
		"route": {
			"receiver": "some email",
			"routes": [{
				"receiver": "other email",
				"object_matchers": [["a", "=", "b"]]
			}]
		},
		"receivers": [{
			"name": "some email",
			"grafana_managed_receiver_configs": [{
				"name": "some email",
				"type": "email",
				"settings": {
					"addresses": "<some@email.com>"
				}
			}]
		},{
			"name": "other email",
			"grafana_managed_receiver_configs": [{
				"name": "other email",
				"type": "email",
				"settings": {
					"addresses": "<other@email.com>"
				}
			}]
		}]
	}
}
`

var validConfigWithAutogen = `{
	"template_files": {
		"a": "template"
	},
	"alertmanager_config": {
		"route": {
			"receiver": "some email",
			"routes": [{
				"receiver": "some email",
				"object_matchers": [["__grafana_autogenerated__", "=", "true"]],
				"routes": [{
					"receiver": "some email",
					"group_by": ["grafana_folder", "alertname"],
					"object_matchers": [["__grafana_receiver__", "=", "some email"]],
					"continue": false
				},{
					"receiver": "other email",
					"group_by": ["grafana_folder", "alertname"],
					"object_matchers": [["__grafana_receiver__", "=", "other email"]],
					"continue": false
				}]
			},{
				"receiver": "other email",
				"object_matchers": [["a", "=", "b"]]
			}]
		},
		"receivers": [{
			"name": "some email",
			"grafana_managed_receiver_configs": [{
				"name": "some email",
				"type": "email",
				"settings": {
					"addresses": "<some@email.com>"
				}
			}]
		},{
			"name": "other email",
			"grafana_managed_receiver_configs": [{
				"name": "other email",
				"type": "email",
				"settings": {
					"addresses": "<other@email.com>"
				}
			}]
		}]
	}
}
`

var brokenConfig = `
	"alertmanager_config": {
		"route": {
			"receiver": "grafana-default-email"
		},
		"receivers": [{
			"name": "grafana-default-email",
			"grafana_managed_receiver_configs": [{
				"uid": "abc",
				"name": "default-email",
				"type": "email",
				"settings": {}
			}]
		}]
	}
}`

func createRequestCtxInOrg(org int64) *contextmodel.ReqContext {
	return &contextmodel.ReqContext{
		Context: &web.Context{
			Req: &http.Request{},
		},
		SignedInUser: &user.SignedInUser{
			OrgID: org,
		},
	}
}

// setRouteProvenance marks an org's routing tree as provisioned.
func setRouteProvenance(t *testing.T, orgID int64, ps provisioning.ProvisioningStore) {
	t.Helper()
	err := ps.SetProvenance(context.Background(), &apimodels.Route{}, orgID, ngmodels.ProvenanceAPI)
	require.NoError(t, err)
}

// setContactPointProvenance marks a contact point as provisioned.
func setContactPointProvenance(t *testing.T, orgID int64, UID string, ps provisioning.ProvisioningStore) {
	t.Helper()
	err := ps.SetProvenance(context.Background(), &apimodels.EmbeddedContactPoint{UID: UID}, orgID, ngmodels.ProvenanceAPI)
	require.NoError(t, err)
}

// setTemplateProvenance marks a template as provisioned.
func setTemplateProvenance(t *testing.T, orgID int64, name string, ps provisioning.ProvisioningStore) {
	t.Helper()
	err := ps.SetProvenance(context.Background(), &apimodels.NotificationTemplate{Name: name}, orgID, ngmodels.ProvenanceAPI)
	require.NoError(t, err)
}

func asGettableUserConfig(t *testing.T, r response.Response) *apimodels.GettableUserConfig {
	t.Helper()
	body := &apimodels.GettableUserConfig{}
	err := json.Unmarshal(r.Body(), body)
	require.NoError(t, err)
	return body
}

func asGettableHistoricUserConfigs(t *testing.T, r response.Response) []apimodels.GettableHistoricUserConfig {
	t.Helper()
	var body []apimodels.GettableHistoricUserConfig
	err := json.Unmarshal(r.Body(), &body)
	require.NoError(t, err)
	return body
}

// RoutePostAlertingConfig drop-in replacement for removed POST endpoint to make test transition easier.
func RoutePostAlertingConfig(t *testing.T, mam *notifier.MultiOrgAlertmanager, rc *contextmodel.ReqContext, amConfig string) {
	t.Helper()
	cfg := apimodels.PostableUserConfig{}
	err := json.Unmarshal([]byte(amConfig), &cfg)
	require.NoError(t, err)
	err = mam.SaveAndApplyAlertmanagerConfiguration(rc.Req.Context(), 1, cfg)
	require.NoError(t, err)
}
