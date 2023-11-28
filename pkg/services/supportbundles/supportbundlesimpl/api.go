package supportbundlesimpl

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	grafanaApi "github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/web"
)

const rootUrl = "/api/support-bundles"

func (s *Service) registerAPIEndpoints(httpServer *grafanaApi.HTTPServer, routeRegister routing.RouteRegister) {
	authorize := ac.Middleware(s.accessControl)

	supportBundlePageAccess := ac.EvalAny(
		ac.EvalPermission(ActionRead),
		ac.EvalPermission(ActionCreate),
	)

	routeRegister.Get("/support-bundles", authorize(supportBundlePageAccess), httpServer.Index)
	routeRegister.Get("/support-bundles/create", authorize(ac.EvalPermission(ActionCreate)), httpServer.Index)

	routeRegister.Group(rootUrl, func(subrouter routing.RouteRegister) {
		subrouter.Get("/", authorize(ac.EvalPermission(ActionRead)), routing.Wrap(s.handleList))
		subrouter.Post("/", authorize(ac.EvalPermission(ActionCreate)), routing.Wrap(s.handleCreate))
		subrouter.Get("/:uid", authorize(ac.EvalPermission(ActionRead)), s.handleDownload)
		subrouter.Delete("/:uid", authorize(ac.EvalPermission(ActionDelete)), s.handleRemove)
		subrouter.Get("/collectors", authorize(ac.EvalPermission(ActionCreate)), routing.Wrap(s.handleGetCollectors))
	})
}

func (s *Service) handleList(ctx *contextmodel.ReqContext) response.Response {
	bundles, err := s.list(ctx.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to list bundles", err)
	}

	data, err := json.Marshal(bundles)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to encode bundle", err)
	}

	return response.JSON(http.StatusOK, data)
}

func (s *Service) handleCreate(ctx *contextmodel.ReqContext) response.Response {
	type command struct {
		Collectors []string `json:"collectors"`
	}

	var c command
	if err := web.Bind(ctx.Req, &c); err != nil {
		return response.Error(http.StatusBadRequest, "failed to parse request", err)
	}

	bundle, err := s.create(context.Background(), c.Collectors, ctx.SignedInUser)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to create support bundle", err)
	}

	data, err := json.Marshal(bundle)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to encode bundle", err)
	}

	return response.JSON(http.StatusCreated, data)
}

func (s *Service) handleDownload(ctx *contextmodel.ReqContext) response.Response {
	uid := web.Params(ctx.Req)[":uid"]
	bundle, err := s.get(ctx.Req.Context(), uid)
	if err != nil {
		return response.Redirect("/support-bundles")
	}

	if bundle.State != supportbundles.StateComplete {
		return response.Redirect("/support-bundles")
	}

	ctx.Resp.Header().Set("Content-Type", "application/tar+gzip")
	ctx.Resp.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s.tar.gz", uid))
	if len(s.encryptionPublicKeys) > 0 {
		ctx.Resp.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s.tar.gz.age", uid))
	}

	return response.CreateNormalResponse(ctx.Resp.Header(), bundle.TarBytes, http.StatusOK)
}

func (s *Service) handleRemove(ctx *contextmodel.ReqContext) response.Response {
	uid := web.Params(ctx.Req)[":uid"]
	err := s.remove(ctx.Req.Context(), uid)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to remove bundle", err)
	}

	return response.Respond(http.StatusOK, "successfully removed the support bundle")
}

func (s *Service) handleGetCollectors(ctx *contextmodel.ReqContext) response.Response {
	collectors := make([]supportbundles.Collector, 0, len(s.bundleRegistry.Collectors()))

	for _, c := range s.bundleRegistry.Collectors() {
		collectors = append(collectors, c)
	}

	return response.JSON(http.StatusOK, collectors)
}
