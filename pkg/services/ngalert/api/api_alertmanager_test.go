package api

import (
	"context"
	"io/ioutil"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
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
				Error:  notifier.InvalidReceiverError{},
			}},
		}, {
			Name: "test2",
			Configs: []notifier.TestReceiverConfigResult{{
				Name:   "test2",
				UID:    "uid2",
				Status: "failed",
				Error:  notifier.InvalidReceiverError{},
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
				Error:  notifier.ReceiverTimeoutError{},
			}},
		}, {
			Name: "test2",
			Configs: []notifier.TestReceiverConfigResult{{
				Name:   "test2",
				UID:    "uid2",
				Status: "failed",
				Error:  notifier.ReceiverTimeoutError{},
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
				Error:  notifier.InvalidReceiverError{},
			}},
		}, {
			Name: "test2",
			Configs: []notifier.TestReceiverConfigResult{{
				Name:   "test2",
				UID:    "uid2",
				Status: "failed",
				Error:  notifier.ReceiverTimeoutError{},
			}},
		}}))
	})
}

func TestAlertmanagerConfig(t *testing.T) {
	sut := createSut(t)

	t.Run("assert 404 Not Found when applying config to nonexistent org", func(t *testing.T) {
		rc := models.ReqContext{
			SignedInUser: &models.SignedInUser{
				OrgRole: models.ROLE_EDITOR,
				OrgId:   12,
			},
		}
		request := createAmConfigRequest(t)

		response := sut.RoutePostAlertingConfig(&rc, request)

		require.Equal(t, 404, response.Status())
		require.Contains(t, string(response.Body()), "Alertmanager does not exist for this organization")
	})

	t.Run("assert 403 Forbidden when applying config while not Editor", func(t *testing.T) {
		rc := models.ReqContext{
			SignedInUser: &models.SignedInUser{
				OrgRole: models.ROLE_VIEWER,
				OrgId:   1,
			},
		}
		request := createAmConfigRequest(t)

		response := sut.RoutePostAlertingConfig(&rc, request)

		require.Equal(t, 403, response.Status())
		require.Contains(t, string(response.Body()), "permission denied")
	})

	t.Run("assert 202 when config successfully applied", func(t *testing.T) {
		rc := models.ReqContext{
			SignedInUser: &models.SignedInUser{
				OrgRole: models.ROLE_EDITOR,
				OrgId:   1,
			},
		}
		request := createAmConfigRequest(t)

		response := sut.RoutePostAlertingConfig(&rc, request)

		require.Equal(t, 202, response.Status())
	})

	t.Run("assert 202 when alertmanager to configure is not ready", func(t *testing.T) {
		sut := createSut(t)
		rc := models.ReqContext{
			SignedInUser: &models.SignedInUser{
				OrgRole: models.ROLE_EDITOR,
				OrgId:   3, // Org 3 was initialized with broken config.
			},
		}
		request := createAmConfigRequest(t)

		response := sut.RoutePostAlertingConfig(&rc, request)

		require.Equal(t, 202, response.Status())
	})
}

func createSut(t *testing.T) AlertmanagerSrv {
	t.Helper()

	mam := createMultiOrgAlertmanager(t)
	store := newFakeAlertingStore(t)
	store.Setup(1)
	store.Setup(2)
	store.Setup(3)
	secrets := fakes.NewFakeSecretsService()
	return AlertmanagerSrv{mam: mam, store: store, secrets: secrets}
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
	tmpDir, err := ioutil.TempDir("", "test")
	require.NoError(t, err)
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

	mam, err := notifier.NewMultiOrgAlertmanager(cfg, &configStore, &orgStore, kvStore, decryptFn, m.GetMultiOrgAlertmanagerMetrics(), log.New("testlogger"))
	require.NoError(t, err)
	t.Cleanup(cleanOrgDirectories(tmpDir, t))
	err = mam.LoadAndSyncAlertmanagersForOrgs(context.Background())
	require.NoError(t, err)
	return mam
}

func cleanOrgDirectories(path string, t *testing.T) func() {
	return func() {
		require.NoError(t, os.RemoveAll(path))
	}
}

var validConfig = setting.GetAlertmanagerDefaultConfiguration()

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
