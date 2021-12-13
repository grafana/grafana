package api

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
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
				OrgId:   5,
			},
		}
		request := apimodels.PostableUserConfig{}

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
		request := apimodels.PostableUserConfig{}

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
		request := apimodels.PostableUserConfig{}

		response := sut.RoutePostAlertingConfig(&rc, request)

		require.Equal(t, 202, response.Status())
	})

	t.Run("assert 202 when alertmanager to configure is not ready", func(t *testing.T) {
		sut := createSutWithNonReadyAlertmanager(t)
		rc := models.ReqContext{
			SignedInUser: &models.SignedInUser{
				OrgRole: models.ROLE_EDITOR,
				OrgId:   1,
			},
		}
		request := apimodels.PostableUserConfig{}

		response := sut.RoutePostAlertingConfig(&rc, request)

		require.Equal(t, 202, response.Status())
	})
}

func createSut(t *testing.T) AlertmanagerSrv {
	t.Helper()

	mam := newAlertmanagerProvider(t)
	store := newFakeAlertingStore(t)
	mam.Setup(1)
	mam.Setup(2)
	store.Setup(1)
	store.Setup(2)
	secrets := FakeSecretService{}
	return AlertmanagerSrv{mam: mam, store: store, secrets: secrets}
}

func createSutWithNonReadyAlertmanager(t *testing.T) AlertmanagerSrv {
	t.Helper()

	mam := NonReadyAlertmanagerProvider{
		alertmanagers: map[int64]Alertmanager{},
	}
	store := newFakeAlertingStore(t)
	secrets := FakeSecretService{}
	mam.Setup(1)
	store.Setup(1)
	return AlertmanagerSrv{mam: mam, store: store, secrets: secrets}
}

type NonReadyAlertmanagerProvider struct {
	alertmanagers map[int64]Alertmanager
}

func (f NonReadyAlertmanagerProvider) Setup(orgID int64) {
	f.alertmanagers[orgID] = &FakeAlertmanager{}
}

func (f NonReadyAlertmanagerProvider) AlertmanagerFor(orgID int64) (Alertmanager, error) {
	if am, ok := f.alertmanagers[orgID]; ok {
		return am, notifier.ErrAlertmanagerNotReady
	}
	return nil, notifier.ErrNoAlertmanagerForOrg
}
