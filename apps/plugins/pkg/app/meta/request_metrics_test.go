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
	count := func(resource, verb, caller, origin string) float64 {
		return testutil.ToFloat64(metrics.APIRequestsTotal.WithLabelValues(resource, verb, caller, origin))
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

	do := func(c *restful.Container, rootPath string, claims *authn.AccessTokenClaims) {
		req := httptest.NewRequest(http.MethodGet, rootPath+"/namespaces/stacks-1/metas", nil)
		ctx := request.WithRequestInfo(req.Context(), &request.RequestInfo{IsResourceRequest: true, Resource: "metas", Verb: "list"})
		if claims != nil {
			ctx = authtypes.WithAuthInfo(ctx, authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: *claims}))
		}
		rec := httptest.NewRecorder()
		c.ServeHTTP(rec, req.WithContext(ctx))
		require.Equal(t, http.StatusOK, rec.Code)
	}

	const root = "/apis/plugins.grafana.app/v0alpha1"

	t.Run("origin equals caller when there is no actor chain", func(t *testing.T) {
		c := newContainer(root)
		before := count("metas", "list", "direct-svc", "direct-svc")

		do(c, root, &authn.AccessTokenClaims{ServiceIdentity: "direct-svc"})

		assert.Equal(t, before+1, count("metas", "list", "direct-svc", "direct-svc"))
	})

	t.Run("origin is the innermost actor's service identity", func(t *testing.T) {
		c := newContainer(root)
		before := count("metas", "list", "proxy-svc", "origin-svc")

		do(c, root, &authn.AccessTokenClaims{
			ServiceIdentity: "proxy-svc",
			Actor:           &authn.ActorClaims{Subject: "access-policy:origin", ServiceIdentity: "origin-svc"},
		})

		assert.Equal(t, before+1, count("metas", "list", "proxy-svc", "origin-svc"))
	})

	t.Run("origin falls back to caller when the innermost actor has no service identity", func(t *testing.T) {
		c := newContainer(root)
		before := count("metas", "list", "proxy-svc", "proxy-svc")

		do(c, root, &authn.AccessTokenClaims{
			ServiceIdentity: "proxy-svc",
			Actor:           &authn.ActorClaims{Subject: "user:123"},
		})

		assert.Equal(t, before+1, count("metas", "list", "proxy-svc", "proxy-svc"))
	})

	t.Run("requests without a service identity are unknown", func(t *testing.T) {
		c := newContainer(root)
		before := count("metas", "list", "unknown", "unknown")

		do(c, root, nil)

		assert.Equal(t, before+1, count("metas", "list", "unknown", "unknown"))
	})

	t.Run("ignores other API groups", func(t *testing.T) {
		const other = "/apis/other.grafana.app/v1"
		c := newContainer(other)
		before := count("metas", "list", "other-svc", "other-svc")

		do(c, other, &authn.AccessTokenClaims{ServiceIdentity: "other-svc"})

		assert.Equal(t, before, count("metas", "list", "other-svc", "other-svc"))
	})
}
