package clientmiddleware

import (
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestUserAlertingHeadersMiddleware(t *testing.T) {
	testQueryDataReq := func(t *testing.T, req *http.Request) *backend.QueryDataRequest {
		cdt := handlertest.NewHandlerMiddlewareTest(t,
			WithReqContext(req, &user.SignedInUser{}),
			handlertest.WithMiddlewares(NewUseAlertHeadersMiddleware()),
		)

		pluginCtx := backend.PluginContext{
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{},
		}

		_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
			PluginContext: pluginCtx,
			Headers:       map[string]string{},
		})
		require.NoError(t, err)
		return cdt.QueryDataReq
	}

	t.Run("Handle non-alerting case without problems", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)
		outReq := testQueryDataReq(t, req)

		// special marker
		require.Equal(t, "", outReq.Headers["FromAlert"])

		// the normal http headers
		require.Equal(t, "", outReq.GetHTTPHeader("X-Rule-Name"))
		require.Equal(t, "", outReq.GetHTTPHeader("X-Rule-Uid"))
		require.Equal(t, "", outReq.GetHTTPHeader("X-Rule-Folder"))
		require.Equal(t, "", outReq.GetHTTPHeader("X-Rule-Source"))
		require.Equal(t, "", outReq.GetHTTPHeader("X-Rule-Type"))
		require.Equal(t, "", outReq.GetHTTPHeader("X-Rule-Version"))
	})

	t.Run("Use Alerting headers when they exist", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/some/thing", nil)
		require.NoError(t, err)
		req.Header.Set("Fromalert", "true")
		req.Header.Set("X-Rule-Name", "n1")
		req.Header.Set("X-Rule-Uid", "u1")
		req.Header.Set("X-Rule-Folder", "f1")
		req.Header.Set("X-Rule-Source", "s1")
		req.Header.Set("X-Rule-Type", "t1")
		req.Header.Set("X-Rule-Version", "v1")

		outReq := testQueryDataReq(t, req)

		// special marker
		require.Equal(t, "true", outReq.Headers["FromAlert"])

		// normal http headers
		require.Equal(t, "n1", outReq.GetHTTPHeader("X-Rule-Name"))
		require.Equal(t, "u1", outReq.GetHTTPHeader("X-Rule-Uid"))
		require.Equal(t, "f1", outReq.GetHTTPHeader("X-Rule-Folder"))
		require.Equal(t, "s1", outReq.GetHTTPHeader("X-Rule-Source"))
		require.Equal(t, "t1", outReq.GetHTTPHeader("X-Rule-Type"))
		require.Equal(t, "v1", outReq.GetHTTPHeader("X-Rule-Version"))
	})
}
