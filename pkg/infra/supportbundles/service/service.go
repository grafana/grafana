package service

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type SupportBundleService struct {
	Cfg *setting.Cfg

	log log.Logger
}

const rootUrl = "/api/support-bundles"

func ProvideService(cfg *setting.Cfg, kvStore kvstore.KVStore, routeRegister routing.RouteRegister, tracer tracing.Tracer) *UsageStats {
	s := &SupportBundleService{
		Cfg: cfg,
		log: log.New("supportbundle.service"),
	}

	s.registerAPIEndpoints(routeRegister)
	return s
}

func (s *SupportBundleService) registerAPIEndpoints(routeRegister routing.RouteRegister) {
	routeRegister.Group(rootUrl, func(subrouter routing.RouteRegister) {
		subrouter.Get("/", middleware.ReqGrafanaAdmin, routing.Wrap(s.listSupportBundles))
		subrouter.Post("/", middleware.ReqGrafanaAdmin, routing.Wrap(s.createSupportBundle))
		subrouter.Get("/:id", middleware.ReqGrafanaAdmin, routing.Wrap(s.createSupportBundle))
	})
}

func (s *SupportBundleService) listSupportBundles(ctx *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, []string{})
}

func (s *SupportBundleService) createSupportBundle(ctx *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, []string{})
}
func (s *SupportBundleService) getSupportBundle(ctx *models.ReqContext) response.Response {
	uid := web.Params(ctx.Req)[":uid"]

	return response.JSON(http.StatusOK, []string{uid})
}
