package api

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestRenderHandlerPageLoadFailure(t *testing.T) {
	serve := func(t *testing.T, renderErr error) *httptest.ResponseRecorder {
		t.Helper()

		cfg := setting.NewCfg()
		cfg.ErrTemplateName = "error"

		ctrl := gomock.NewController(t)
		renderSvc := rendering.NewMockService(ctrl)
		renderSvc.EXPECT().Render(gomock.Any(), rendering.RenderPNG, gomock.Any()).Return(nil, renderErr)

		hs := &HTTPServer{Cfg: cfg, RenderService: renderSvc, log: log.New("render-test")}

		viewsPath, err := filepath.Abs("../../public/views")
		require.NoError(t, err)

		m := web.New()
		m.UseMiddleware(web.Renderer(viewsPath, "[[", "]]"))
		m.Get("/render/*", func(ctx *web.Context) {
			hs.RenderHandler(&contextmodel.ReqContext{
				Context:      ctx,
				Logger:       log.New("render-test"),
				SignedInUser: &user.SignedInUser{OrgID: 1, UserID: 1, OrgRole: org.RoleAdmin},
			})
		})

		rec := httptest.NewRecorder()
		m.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/render/d/missing/x?orgId=1", nil))
		return rec
	}

	t.Run("a page load error is answered with 424 and the reason", func(t *testing.T) {
		rec := serve(t, &rendering.PageLoadError{Reason: "Dashboard not found"})

		require.Equal(t, http.StatusFailedDependency, rec.Code)
		require.Contains(t, rec.Body.String(), "Dashboard not found")
	})

	t.Run("other failures are still answered with 500", func(t *testing.T) {
		rec := serve(t, errors.New("boom"))

		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.NotContains(t, rec.Body.String(), "boom")
	})
}
