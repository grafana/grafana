package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"

	am_config "github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/require"
)

func TestRouteGetReceiver(t *testing.T) {
	fakeReceiverSvc := fakes.NewFakeReceiverService()

	t.Run("returns expected model", func(t *testing.T) {
		expected := definitions.GettableApiReceiver{
			Receiver: am_config.Receiver{
				Name: "receiver1",
			},
			GettableGrafanaReceivers: definitions.GettableGrafanaReceivers{
				GrafanaManagedReceivers: []*definitions.GettableGrafanaReceiver{
					{
						UID:  "uid1",
						Name: "receiver1",
						Type: "slack",
					},
				},
			},
		}
		fakeReceiverSvc.GetReceiverFn = func(ctx context.Context, q models.GetReceiverQuery, u identity.Requester) (definitions.GettableApiReceiver, error) {
			return expected, nil
		}
		handler := NewNotificationsApi(newNotificationSrv(fakeReceiverSvc))
		rc := testReqCtx("GET")
		resp := handler.handleRouteGetReceiver(&rc, "receiver1")
		require.Equal(t, http.StatusOK, resp.Status())
		json, err := json.Marshal(expected)
		require.NoError(t, err)
		require.Equal(t, json, resp.Body())
	})

	t.Run("builds query from request context and url param", func(t *testing.T) {
		fakeReceiverSvc.GetReceiverFn = func(ctx context.Context, q models.GetReceiverQuery, u identity.Requester) (definitions.GettableApiReceiver, error) {
			return definitions.GettableApiReceiver{}, nil
		}
		handler := NewNotificationsApi(newNotificationSrv(fakeReceiverSvc))
		rc := testReqCtx("GET")
		rc.Context.Req.Form.Set("decrypt", "true")
		resp := handler.handleRouteGetReceiver(&rc, "receiver1")
		require.Equal(t, http.StatusOK, resp.Status())

		call := fakeReceiverSvc.PopMethodCall()
		require.Equal(t, "GetReceiver", call.Method)
		expectedQ := models.GetReceiverQuery{
			Name:    "receiver1",
			Decrypt: true,
			OrgID:   1,
		}
		require.Equal(t, expectedQ, call.Args[1])
	})

	t.Run("should pass along not found response", func(t *testing.T) {
		fakeReceiverSvc.GetReceiverFn = func(ctx context.Context, q models.GetReceiverQuery, u identity.Requester) (definitions.GettableApiReceiver, error) {
			return definitions.GettableApiReceiver{}, notifier.ErrNotFound
		}
		handler := NewNotificationsApi(newNotificationSrv(fakeReceiverSvc))
		rc := testReqCtx("GET")
		resp := handler.handleRouteGetReceiver(&rc, "receiver1")
		require.Equal(t, http.StatusNotFound, resp.Status())
	})

	t.Run("should pass along permission denied response", func(t *testing.T) {
		fakeReceiverSvc.GetReceiverFn = func(ctx context.Context, q models.GetReceiverQuery, u identity.Requester) (definitions.GettableApiReceiver, error) {
			return definitions.GettableApiReceiver{}, notifier.ErrPermissionDenied
		}
		handler := NewNotificationsApi(newNotificationSrv(fakeReceiverSvc))
		rc := testReqCtx("GET")
		resp := handler.handleRouteGetReceiver(&rc, "receiver1")
		require.Equal(t, http.StatusForbidden, resp.Status())
	})
}

func TestRouteGetReceivers(t *testing.T) {
	fakeReceiverSvc := fakes.NewFakeReceiverService()

	t.Run("returns expected model", func(t *testing.T) {
		expected := []definitions.GettableApiReceiver{
			{
				Receiver: am_config.Receiver{
					Name: "receiver1",
				},
				GettableGrafanaReceivers: definitions.GettableGrafanaReceivers{
					GrafanaManagedReceivers: []*definitions.GettableGrafanaReceiver{
						{
							UID:  "uid1",
							Name: "receiver1",
							Type: "slack",
						},
					},
				},
			},
		}
		fakeReceiverSvc.GetReceiversFn = func(ctx context.Context, q models.GetReceiversQuery, u identity.Requester) ([]definitions.GettableApiReceiver, error) {
			return expected, nil
		}
		handler := NewNotificationsApi(newNotificationSrv(fakeReceiverSvc))
		rc := testReqCtx("GET")
		rc.Context.Req.Form.Set("names", "receiver1")
		resp := handler.handleRouteGetReceivers(&rc)
		require.Equal(t, http.StatusOK, resp.Status())
		json, err := json.Marshal(expected)
		require.NoError(t, err)
		require.Equal(t, json, resp.Body())
	})

	t.Run("builds query from request context", func(t *testing.T) {
		fakeReceiverSvc.GetReceiversFn = func(ctx context.Context, q models.GetReceiversQuery, u identity.Requester) ([]definitions.GettableApiReceiver, error) {
			return []definitions.GettableApiReceiver{}, nil
		}
		handler := NewNotificationsApi(newNotificationSrv(fakeReceiverSvc))
		rc := testReqCtx("GET")
		rc.Context.Req.Form.Set("names", "receiver1")
		rc.Context.Req.Form.Add("names", "receiver2")
		rc.Context.Req.Form.Set("limit", "1")
		rc.Context.Req.Form.Set("offset", "2")
		rc.Context.Req.Form.Set("decrypt", "true")
		resp := handler.handleRouteGetReceivers(&rc)
		require.Equal(t, http.StatusOK, resp.Status())

		call := fakeReceiverSvc.PopMethodCall()
		require.Equal(t, "GetReceivers", call.Method)
		expectedQ := models.GetReceiversQuery{
			Names:   []string{"receiver1", "receiver2"},
			Limit:   1,
			Offset:  2,
			Decrypt: true,
			OrgID:   1,
		}
		require.Equal(t, expectedQ, call.Args[1])
	})

	t.Run("should pass along permission denied response", func(t *testing.T) {
		fakeReceiverSvc.GetReceiversFn = func(ctx context.Context, q models.GetReceiversQuery, u identity.Requester) ([]definitions.GettableApiReceiver, error) {
			return nil, notifier.ErrPermissionDenied
		}
		handler := NewNotificationsApi(newNotificationSrv(fakeReceiverSvc))
		rc := testReqCtx("GET")
		resp := handler.handleRouteGetReceivers(&rc)
		require.Equal(t, http.StatusForbidden, resp.Status())
	})
}

func newNotificationSrv(receiverService ReceiverService) *NotificationSrv {
	return &NotificationSrv{
		logger:          log.NewNopLogger(),
		receiverService: receiverService,
	}
}

func testReqCtx(method string) contextmodel.ReqContext {
	return contextmodel.ReqContext{
		Context: &web.Context{
			Req: &http.Request{
				Header: make(http.Header),
				Form:   make(url.Values),
			},
			Resp: web.NewResponseWriter(method, httptest.NewRecorder()),
		},
		SignedInUser: &user.SignedInUser{
			OrgID: 1,
		},
		Logger: &logtest.Fake{},
	}
}
