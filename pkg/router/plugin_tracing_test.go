package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute"
)

func TestPluginRouteTracing(t *testing.T) {
	for _, token := range []string{"", "invalid", "valid"} {
		t.Run("token="+token, func(t *testing.T) {
			spans := setupRouterTracing(t)
			var authContext, handlerContext trace.SpanContext
			requester := &identity.StaticRequester{}
			handler := &authenticatingWrapper{
				authn: manifestTokenAuthenticatorFunc(func(ctx context.Context, token string) (identity.Requester, error) {
					authContext = trace.SpanContextFromContext(ctx)
					if token != "valid" {
						return nil, apierrors.NewUnauthorized("invalid token")
					}
					return requester, nil
				}),
				Handler: &tracedPluginHandler{
					pluginID: "test-app",
					Handler: &pluginroute.Handler{Handler: http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
						handlerContext = trace.SpanContextFromContext(req.Context())
						got, err := identity.GetRequester(req.Context())
						require.NoError(t, err)
						require.Same(t, requester, got)
						w.WriteHeader(http.StatusCreated)
					})},
				},
			}
			req := httptest.NewRequest(http.MethodPost, "/apis/test.ext.grafana.app/v1/resources", nil)
			req.Header.Set("X-Access-Token", token)
			response := httptest.NewRecorder()
			serveThroughBreaker(newGroupBreaker("test.ext.grafana.app"), "test.ext.grafana.app", handler, response, req)
			ended := spans.Ended()
			require.Equal(t, "router.plugin.authenticate", ended[0].Name())
			if token == "valid" {
				require.Equal(t, http.StatusCreated, response.Code)
				require.Len(t, ended, 2)
				require.Equal(t, "router.backend", ended[1].Name())
				require.Contains(t, ended[1].Attributes(), attribute.String("grafana.plugin.id", "test-app"))
				require.Equal(t, handlerContext, ended[1].SpanContext())
				require.Contains(t, ended[1].Attributes(), attribute.Int("http.response.status_code", http.StatusCreated))
			} else {
				require.Equal(t, http.StatusUnauthorized, response.Code)
				require.Len(t, ended, 2)
				require.False(t, handlerContext.IsValid())
				require.Equal(t, codes.Error, ended[0].Status().Code)
				expectedError := "invalid_token"
				if token == "" {
					expectedError = "missing_token"
				}
				require.Contains(t, ended[0].Attributes(), attribute.String("error.type", expectedError))
			}
			if token != "" {
				require.Equal(t, authContext, ended[0].SpanContext())
			}
			for _, attr := range ended[0].Attributes() {
				require.NotEqual(t, attribute.Key("http.response.status_code"), attr.Key)
			}
			backend := ended[len(ended)-1]
			require.Equal(t, "router.backend", backend.Name())
			require.Equal(t, backend.SpanContext().SpanID(), ended[0].Parent().SpanID())
		})
	}
}
