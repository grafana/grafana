package supportbundlesimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/supportbundles"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/web"
)

const rootUrl = "/api/support-bundles"

func (s *Service) registerAPIEndpoints(routeRegister routing.RouteRegister) {
	authorize := ac.Middleware(s.accessControl)

	routeRegister.Group(rootUrl, func(subrouter routing.RouteRegister) {
		subrouter.Get("/", authorize(middleware.ReqGrafanaAdmin,
			ac.EvalPermission(ActionRead)), routing.Wrap(s.handleList))
		subrouter.Post("/", authorize(middleware.ReqGrafanaAdmin,
			ac.EvalPermission(ActionCreate)), routing.Wrap(s.handleCreate))
		subrouter.Get("/:uid", authorize(middleware.ReqGrafanaAdmin,
			ac.EvalPermission(ActionRead)), s.handleDownload)
		subrouter.Delete("/:uid", authorize(middleware.ReqGrafanaAdmin,
			ac.EvalPermission(ActionDelete)), s.handleRemove)
		subrouter.Get("/collectors", authorize(middleware.ReqGrafanaAdmin,
			ac.EvalPermission(ActionCreate)), routing.Wrap(s.handleGetCollectors))
	})
}

func (s *Service) handleList(ctx *models.ReqContext) response.Response {
	bundles, err := s.List(ctx.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to list bundles", err)
	}

	data, err := json.Marshal(bundles)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to encode bundle", err)
	}

	return response.JSON(http.StatusOK, data)
}

func (s *Service) handleCreate(ctx *models.ReqContext) response.Response {
	type command struct {
		Collectors []string `json:"collectors"`
	}

	var c command
	if err := web.Bind(ctx.Req, &c); err != nil {
		return response.Error(http.StatusBadRequest, "failed to parse request", err)
	}

	bundle, err := s.Create(context.Background(), c.Collectors, ctx.SignedInUser)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to create support bundle", err)
	}

	data, err := json.Marshal(bundle)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to encode bundle", err)
	}

	return response.JSON(http.StatusCreated, data)
}

func (s *Service) handleDownload(ctx *models.ReqContext) {
	uid := web.Params(ctx.Req)[":uid"]
	bundle, err := s.Get(ctx.Req.Context(), uid)
	if err != nil {
		ctx.Redirect("/admin/support-bundles")
		return
	}

	if bundle.State != supportbundles.StateComplete {
		ctx.Redirect("/admin/support-bundles")
		return
	}

	if bundle.FilePath == "" {
		ctx.Redirect("/admin/support-bundles")
		return
	}

	if _, err := os.Stat(bundle.FilePath); err != nil {
		ctx.Redirect("/admin/support-bundles")
		return
	}

	ctx.Resp.Header().Set("Content-Type", "application/tar+gzip")
	ctx.Resp.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%d.tar.gz", bundle.CreatedAt))
	http.ServeFile(ctx.Resp, ctx.Req, bundle.FilePath)
}

func (s *Service) handleRemove(ctx *models.ReqContext) response.Response {
	uid := web.Params(ctx.Req)[":uid"]
	err := s.Remove(ctx.Req.Context(), uid)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to remove bundle", err)
	}

	return response.Respond(http.StatusOK, "successfully removed the support bundle")
}

func (s *Service) handleGetCollectors(ctx *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, s.collectors)
}
