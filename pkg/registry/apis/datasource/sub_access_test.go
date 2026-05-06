package datasource

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	datasourceV0alpha1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	"github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestSubAccessREST_GetAccessInfoUsesDatasourceUID(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-uid/access", nil)
	recorder := httptest.NewRecorder()
	reqCtx := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter(req.Method, recorder),
		},
		SignedInUser: &user.SignedInUser{
			OrgID: 1,
			Permissions: map[int64]map[string][]string{
				1: {
					"datasources:read":  {"datasources:uid:test-uid"},
					"datasources:query": {"datasources:uid:other-uid"},
				},
			},
		},
	}
	ctx := ctxkey.Set(context.Background(), reqCtx)

	accessREST := &subAccessREST{}
	accessInfo, err := accessREST.getAccessInfo(ctx, "test-uid")
	require.NoError(t, err)
	require.Equal(t, &datasourceV0alpha1.DatasourceAccessInfo{
		Permissions: map[string]bool{
			"datasources:read": true,
		},
	}, accessInfo)
}
