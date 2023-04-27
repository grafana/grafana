package api

import (
	"context"
	"encoding/json"
	"math/rand"
	"net/http"
	"testing"
	"time"

	"github.com/go-openapi/strfmt"
	alertingNotify "github.com/grafana/alerting/notify"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acMock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
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

func TestStatusForTestReceivers(t *testing.T) {
	t.Run("assert HTTP 400 Status Bad Request for no receivers", func(t *testing.T) {
		require.Equal(t, http.StatusBadRequest, statusForTestReceivers([]notifier.TestReceiverResult{}))
	})

	t.Run("assert HTTP 400 Bad Request when all invalid receivers", func(t *testing.T) {
		require.Equal(t, http.StatusBadRequest, statusForTestReceivers([]notifier.TestReceiverResult{{
			Name: "test1",
			Configs: []notifier.TestReceiverConfigResult{{
				Name:   "test1",
				UID:    "uid1",
				Status: "failed",
				Error:  alertingNotify.IntegrationValidationError{},
			}},
		}, {
			Name: "test2",
			Configs: []notifier.TestReceiverConfigResult{{
				Name:   "test2",
				UID:    "uid2",
				Status: "failed",
				Error:  alertingNotify.IntegrationValidationError{},
			}},
		}}))
	})

	t.Run("assert HTTP 408 Request Timeout when all receivers timed out", func(t *testing.T) {
		require.Equal(t, http.StatusRequestTimeout, statusForTestReceivers([]notifier.TestReceiverResult{{
			Name: "test1",
			Configs: []notifier.TestReceiverConfigResult{{
				Name:   "test1",
				UID:    "uid1",
				Status: "failed",
				Error:  alertingNotify.IntegrationTimeoutError{},
			}},
		}, {
			Name: "test2",
			Configs: []notifier.TestReceiverConfigResult{{
				Name:   "test2",
				UID:    "uid2",
				Status: "failed",
				Error:  alertingNotify.IntegrationTimeoutError{},
			}},
		}}))
	})

	t.Run("assert 207 Multi Status for different errors", func(t *testing.T) {
		require.Equal(t, http.StatusMultiStatus, statusForTestReceivers([]notifier.TestReceiverResult{{
			Name: "test1",
			Configs: []notifier.TestReceiverConfigResult{{
				Name:   "test1",
				UID:    "uid1",
				Status: "failed",
				Error:  alertingNotify.IntegrationValidationError{},
			}},
		}, {
			Name: "test2",
			Configs: []notifier.TestReceiverConfigResult{{
				Name:   "test2",
				UID:    "uid2",
				Status: "failed",
				Error:  alertingNotify.IntegrationTimeoutError{},
			}},
		}}))
	})
}

func TestAlertmanagerConfig(t *testing.T) {
	sut := createSut(t, nil)

	t.Run("assert 404 Not Found when applying config to nonexistent org", func(t *testing.T) {
		rc := contextmodel.ReqContext{
			Context: &web.Context{
				Req: &http.Request{},
			},
			SignedInUser: &user.SignedInUser{
				OrgID: 12,
			},
		}
		request := createAmConfigRequest(t)

		response := sut.RoutePostAlertingConfig(&rc, request)

		require.Equal(t, 404, response.Status())
		require.Contains(t, string(response.Body()), "Alertmanager does not exist for this organization")
	})

	t.Run("assert 202 when config successfully applied", func(t *testing.T) {
		rc := contextmodel.ReqContext{
			Context: &web.Context{
				Req: &http.Request{},
			},
			SignedInUser: &user.SignedInUser{
				OrgID: 1,
			},
		}
		request := createAmConfigRequest(t)

		response := sut.RoutePostAlertingConfig(&rc, request)

		require.Equal(t, 202, response.Status())
	})

	t.Run("assert 202 when alertmanager to configure is not ready", func(t *testing.T) {
		sut := createSut(t, nil)
		rc := contextmodel.ReqContext{
			Context: &web.Context{
				Req: &http.Request{},
			},
			SignedInUser: &user.SignedInUser{
				OrgID: 3, // Org 3 was initialized with broken config.
			},
		}
		request := createAmConfigRequest(t)

		response := sut.RoutePostAlertingConfig(&rc, request)

		require.Equal(t, 202, response.Status())
	})

	t.Run("when objects are not provisioned", func(t *testing.T) {
		t.Run("route from GET config has no provenance", func(t *testing.T) {
			sut := createSut(t, nil)
			rc := createRequestCtxInOrg(1)

			response := sut.RouteGetAlertingConfig(rc)

			body := asGettableUserConfig(t, response)
			require.Equal(t, apimodels.Provenance(ngmodels.ProvenanceNone), body.AlertmanagerConfig.Route.Provenance)
		})
		t.Run("contact point from GET config has no provenance", func(t *testing.T) {
			sut := createSut(t, nil)
			rc := createRequestCtxInOrg(1)

			response := sut.RouteGetAlertingConfig(rc)

			body := asGettableUserConfig(t, response)
			require.Equal(t, apimodels.Provenance(ngmodels.ProvenanceNone), body.AlertmanagerConfig.Receivers[0].GrafanaManagedReceivers[0].Provenance)
		})
		t.Run("templates from GET config have no provenance", func(t *testing.T) {
			sut := createSut(t, nil)
			rc := createRequestCtxInOrg(1)

			response := sut.RouteGetAlertingConfig(rc)

			body := asGettableUserConfig(t, response)
			require.Nil(t, body.TemplateFileProvenances)
		})
	})

	t.Run("when objects are provisioned", func(t *testing.T) {
		t.Run("route from GET config has expected provenance", func(t *testing.T) {
			sut := createSut(t, nil)
			rc := createRequestCtxInOrg(1)
			setRouteProvenance(t, 1, sut.mam.ProvStore)

			response := sut.RouteGetAlertingConfig(rc)

			body := asGettableUserConfig(t, response)
			require.Equal(t, apimodels.Provenance(ngmodels.ProvenanceAPI), body.AlertmanagerConfig.Route.Provenance)
		})
		t.Run("contact point from GET config has expected provenance", func(t *testing.T) {
			sut := createSut(t, nil)
			rc := createRequestCtxInOrg(1)
			request := createAmConfigRequest(t)

			_ = sut.RoutePostAlertingConfig(rc, request)

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
			sut := createSut(t, nil)
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

func TestRouteGetAlertingConfigHistory(t *testing.T) {
	sut := createSut(t, nil)

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
	sut := createSut(t, nil)

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

func TestSilenceCreate(t *testing.T) {
	makeSilence := func(comment string, createdBy string,
		startsAt, endsAt strfmt.DateTime, matchers amv2.Matchers) amv2.Silence {
		return amv2.Silence{
			Comment:   &comment,
			CreatedBy: &createdBy,
			StartsAt:  &startsAt,
			EndsAt:    &endsAt,
			Matchers:  matchers,
		}
	}

	now := time.Now()
	dt := func(t time.Time) strfmt.DateTime { return strfmt.DateTime(t) }
	tru := true
	testString := "testName"
	matchers := amv2.Matchers{&amv2.Matcher{Name: &testString, IsEqual: &tru, IsRegex: &tru, Value: &testString}}

	cases := []struct {
		name    string
		silence amv2.Silence
		status  int
	}{
		{"Valid Silence",
			makeSilence("", "tests", dt(now), dt(now.Add(1*time.Second)), matchers),
			http.StatusAccepted,
		},
		{"No Comment Silence",
			func() amv2.Silence {
				s := makeSilence("", "tests", dt(now), dt(now.Add(1*time.Second)), matchers)
				s.Comment = nil
				return s
			}(),
			http.StatusBadRequest,
		},
	}

	for _, cas := range cases {
		t.Run(cas.name, func(t *testing.T) {
			rc := contextmodel.ReqContext{
				Context: &web.Context{
					Req: &http.Request{},
				},
				SignedInUser: &user.SignedInUser{
					OrgRole: org.RoleEditor,
					OrgID:   1,
				},
			}

			srv := createSut(t, nil)

			resp := srv.RouteCreateSilence(&rc, amv2.PostableSilence{
				ID:      "",
				Silence: cas.silence,
			})
			require.Equal(t, cas.status, resp.Status())
		})
	}
}

func TestRouteCreateSilence(t *testing.T) {
	tesCases := []struct {
		name           string
		silence        func() apimodels.PostableSilence
		accessControl  func() accesscontrol.AccessControl
		role           org.RoleType
		expectedStatus int
	}{
		{
			name:    "new silence, role-based access control is enabled, not authorized",
			silence: silenceGen(withEmptyID),
			accessControl: func() accesscontrol.AccessControl {
				return acMock.New()
			},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:    "new silence, role-based access control is enabled, authorized",
			silence: silenceGen(withEmptyID),
			accessControl: func() accesscontrol.AccessControl {
				return acMock.New().WithPermissions([]accesscontrol.Permission{
					{Action: accesscontrol.ActionAlertingInstanceCreate},
				})
			},
			expectedStatus: http.StatusAccepted,
		},
		{
			name:    "new silence, role-based access control is disabled, Viewer",
			silence: silenceGen(withEmptyID),
			accessControl: func() accesscontrol.AccessControl {
				return acMock.New().WithDisabled()
			},
			role:           org.RoleViewer,
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:    "new silence, role-based access control is disabled, Editor",
			silence: silenceGen(withEmptyID),
			accessControl: func() accesscontrol.AccessControl {
				return acMock.New().WithDisabled()
			},
			role:           org.RoleEditor,
			expectedStatus: http.StatusAccepted,
		},
		{
			name:    "new silence, role-based access control is disabled, Admin",
			silence: silenceGen(withEmptyID),
			accessControl: func() accesscontrol.AccessControl {
				return acMock.New().WithDisabled()
			},
			role:           org.RoleAdmin,
			expectedStatus: http.StatusAccepted,
		},
		{
			name:    "update silence, role-based access control is enabled, not authorized",
			silence: silenceGen(),
			accessControl: func() accesscontrol.AccessControl {
				return acMock.New()
			},
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:    "update silence, role-based access control is enabled, authorized",
			silence: silenceGen(),
			accessControl: func() accesscontrol.AccessControl {
				return acMock.New().WithPermissions([]accesscontrol.Permission{
					{Action: accesscontrol.ActionAlertingInstanceUpdate},
				})
			},
			expectedStatus: http.StatusAccepted,
		},
		{
			name:    "update silence, role-based access control is disabled, Viewer",
			silence: silenceGen(),
			accessControl: func() accesscontrol.AccessControl {
				return acMock.New().WithDisabled()
			},
			role:           org.RoleViewer,
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:    "update silence, role-based access control is disabled, Editor",
			silence: silenceGen(),
			accessControl: func() accesscontrol.AccessControl {
				return acMock.New().WithDisabled()
			},
			role:           org.RoleEditor,
			expectedStatus: http.StatusAccepted,
		},
		{
			name:    "update silence, role-based access control is disabled, Admin",
			silence: silenceGen(),
			accessControl: func() accesscontrol.AccessControl {
				return acMock.New().WithDisabled()
			},
			role:           org.RoleAdmin,
			expectedStatus: http.StatusAccepted,
		},
	}

	for _, tesCase := range tesCases {
		t.Run(tesCase.name, func(t *testing.T) {
			ac := tesCase.accessControl()
			sut := createSut(t, ac)

			rc := contextmodel.ReqContext{
				Context: &web.Context{
					Req: &http.Request{},
				},
				SignedInUser: &user.SignedInUser{
					OrgRole: tesCase.role,
					OrgID:   1,
				},
			}

			silence := tesCase.silence()

			if silence.ID != "" {
				alertmanagerFor, err := sut.mam.AlertmanagerFor(1)
				require.NoError(t, err)
				silence.ID = ""
				newID, err := alertmanagerFor.CreateSilence(&silence)
				require.NoError(t, err)
				silence.ID = newID
			}

			response := sut.RouteCreateSilence(&rc, silence)
			require.Equal(t, tesCase.expectedStatus, response.Status())
		})
	}
}

func createSut(t *testing.T, accessControl accesscontrol.AccessControl) AlertmanagerSrv {
	t.Helper()

	mam := createMultiOrgAlertmanager(t)
	if accessControl == nil {
		accessControl = acMock.New().WithDisabled()
	}
	log := log.NewNopLogger()
	return AlertmanagerSrv{
		mam:    mam,
		crypto: mam.Crypto,
		ac:     accessControl,
		log:    log,
	}
}

func createAmConfigRequest(t *testing.T) apimodels.PostableUserConfig {
	t.Helper()

	request := apimodels.PostableUserConfig{}
	err := request.UnmarshalJSON([]byte(validConfig))
	require.NoError(t, err)

	return request
}

func createMultiOrgAlertmanager(t *testing.T) *notifier.MultiOrgAlertmanager {
	t.Helper()

	configs := map[int64]*ngmodels.AlertConfiguration{
		1: {AlertmanagerConfiguration: validConfig, OrgID: 1},
		2: {AlertmanagerConfiguration: validConfig, OrgID: 2},
		3: {AlertmanagerConfiguration: brokenConfig, OrgID: 3},
	}
	configStore := notifier.NewFakeConfigStore(t, configs)
	orgStore := notifier.NewFakeOrgStore(t, []int64{1, 2, 3})
	provStore := provisioning.NewFakeProvisioningStore()
	tmpDir := t.TempDir()
	kvStore := notifier.NewFakeKVStore(t)
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

	mam, err := notifier.NewMultiOrgAlertmanager(cfg, configStore, &orgStore, kvStore, provStore, decryptFn, m.GetMultiOrgAlertmanagerMetrics(), nil, log.New("testlogger"), secretsService)
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
				"isDefault": true,
				"settings": {
					"addresses": "<example@email.com>"
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
				"isDefault": true,
				"settings": {}
			}]
		}]
	}
}`

func silenceGen(mutatorFuncs ...func(*apimodels.PostableSilence)) func() apimodels.PostableSilence {
	return func() apimodels.PostableSilence {
		testString := util.GenerateShortUID()
		isEqual := rand.Int()%2 == 0
		isRegex := rand.Int()%2 == 0
		value := util.GenerateShortUID()
		if isRegex {
			value = ".*" + util.GenerateShortUID()
		}

		matchers := amv2.Matchers{&amv2.Matcher{Name: &testString, IsEqual: &isEqual, IsRegex: &isRegex, Value: &value}}
		comment := util.GenerateShortUID()
		starts := strfmt.DateTime(timeNow().Add(-time.Duration(rand.Int63n(9)+1) * time.Second))
		ends := strfmt.DateTime(timeNow().Add(time.Duration(rand.Int63n(9)+1) * time.Second))
		createdBy := "User-" + util.GenerateShortUID()
		s := apimodels.PostableSilence{
			ID: util.GenerateShortUID(),
			Silence: amv2.Silence{
				Comment:   &comment,
				CreatedBy: &createdBy,
				EndsAt:    &ends,
				Matchers:  matchers,
				StartsAt:  &starts,
			},
		}

		for _, mutator := range mutatorFuncs {
			mutator(&s)
		}

		return s
	}
}

func withEmptyID(silence *apimodels.PostableSilence) {
	silence.ID = ""
}

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
