package meta

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/emicklei/go-restful/v3"
	"github.com/grafana/authlib/authn"
	authtypes "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
)

func TestAddCallerRequestMetrics(t *testing.T) {
	const root = "/apis/plugins.grafana.app/v0alpha1"

	count := func(resource, verb, caller string) float64 {
		return testutil.ToFloat64(metrics.APIRequestsTotal.WithLabelValues(resource, verb, caller))
	}

	newContainer := func(rootPath string) *restful.Container {
		ws := new(restful.WebService).Path(rootPath)
		ws.Route(ws.GET("/namespaces/{ns}/metas").To(func(_ *restful.Request, resp *restful.Response) {
			resp.WriteHeader(http.StatusOK)
		}))
		container := restful.NewContainer()
		container.Add(ws)
		// The filter is added after routes exist, as it is in InstallAPIs.
		AddCallerRequestMetrics(container.RegisteredWebServices())
		return container
	}

	do := func(c *restful.Container, rootPath string, serviceIdentity string) {
		req := httptest.NewRequest(http.MethodGet, rootPath+"/namespaces/stacks-1/metas", nil)
		ctx := request.WithRequestInfo(req.Context(), &request.RequestInfo{IsResourceRequest: true, Resource: "metas", Verb: "list"})
		if serviceIdentity != "" {
			ctx = authtypes.WithAuthInfo(ctx, authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
				Rest: authn.AccessTokenClaims{ServiceIdentity: serviceIdentity},
			}))
		}
		rec := httptest.NewRecorder()
		c.ServeHTTP(rec, req.WithContext(ctx))
		require.Equal(t, http.StatusOK, rec.Code)
	}

	t.Run("counts requests by caller", func(t *testing.T) {
		c := newContainer(root)
		before := count("metas", "list", "request-metrics-test")
		beforeUnknown := count("metas", "list", "unknown")

		do(c, root, "request-metrics-test")
		do(c, root, "")

		assert.Equal(t, before+1, count("metas", "list", "request-metrics-test"))
		assert.Equal(t, beforeUnknown+1, count("metas", "list", "unknown"))
	})

	t.Run("ignores other API groups", func(t *testing.T) {
		const other = "/apis/other.grafana.app/v1"
		c := newContainer(other)
		before := count("metas", "list", "other-svc")

		do(c, other, "other-svc")

		assert.Equal(t, before, count("metas", "list", "other-svc"))
	})
}
