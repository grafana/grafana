package api

import (
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/go-macaron/binding"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
)

// timeNow makes it possible to test usage of time
var timeNow = time.Now

type Alertmanager interface {
	// Configuration
	SaveAndApplyConfig(config *apimodels.PostableUserConfig) error

	// Silences
	CreateSilence(ps *apimodels.PostableSilence) (string, error)
	DeleteSilence(silenceID string) error
	GetSilence(silenceID string) (apimodels.GettableSilence, error)
	ListSilences(filter []string) (apimodels.GettableSilences, error)

	// Alerts
	GetAlerts(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error)
	GetAlertGroups(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error)
}

// API handlers.
type API struct {
	Cfg             *setting.Cfg
	DatasourceCache datasources.CacheService
	RouteRegister   routing.RouteRegister
	DataService     *tsdb.Service
	Schedule        schedule.ScheduleService
	Store           store.Store
	RuleStore       store.RuleStore
	AlertingStore   store.AlertingStore
	DataProxy       *datasourceproxy.DatasourceProxyService
	Alertmanager    Alertmanager
	StateManager    *state.Manager
}

// RegisterAPIEndpoints registers API handlers
func (api *API) RegisterAPIEndpoints() {
	logger := log.New("ngalert.api")
	proxy := &AlertingProxy{
		DataProxy: api.DataProxy,
	}

	var reg prometheus.Registerer
	// hack, this just assumes that if this histogram is enabled, we should enable others
	// TODO(owen-d): expose this as a config option (alerting-instrumentation or similar)
	if api.Cfg.IsHTTPRequestHistogramEnabled() {
		reg = prometheus.DefaultRegisterer
	}

	// Register endpoints for proxing to Alertmanager-compatible backends.
	api.RegisterAlertmanagerApiEndpoints(NewForkedAM(
		api.DatasourceCache,
		NewLotexAM(proxy, logger),
		AlertmanagerSrv{store: api.AlertingStore, am: api.Alertmanager, log: logger},
	))
	// Register endpoints for proxing to Prometheus-compatible backends.
	api.RegisterPrometheusApiEndpoints(NewForkedProm(
		api.DatasourceCache,
		NewLotexProm(proxy, logger),
		PrometheusSrv{log: logger, manager: api.StateManager, store: api.RuleStore},
	))
	// Register endpoints for proxing to Cortex Ruler-compatible backends.
	api.RegisterRulerApiEndpoints(NewForkedRuler(
		api.DatasourceCache,
		NewLotexRuler(proxy, logger),
		RulerSrv{DatasourceCache: api.DatasourceCache, store: api.RuleStore, log: logger},
		reg,
	))
	api.RegisterTestingApiEndpoints(TestingApiSrv{
		AlertingProxy:   proxy,
		Cfg:             api.Cfg,
		DataService:     api.DataService,
		DatasourceCache: api.DatasourceCache,
		log:             logger,
	})

	// Legacy routes; they will be removed in v8
	api.RouteRegister.Group("/api/alert-definitions", func(alertDefinitions routing.RouteRegister) {
		alertDefinitions.Get("", middleware.ReqSignedIn, routing.Wrap(api.listAlertDefinitions))
		alertDefinitions.Get("/eval/:alertDefinitionUID", middleware.ReqSignedIn, api.validateOrgAlertDefinition, routing.Wrap(api.alertDefinitionEvalEndpoint))
		alertDefinitions.Post("/eval", middleware.ReqSignedIn, binding.Bind(ngmodels.EvalAlertConditionCommand{}), routing.Wrap(api.conditionEvalEndpoint))
		alertDefinitions.Get("/:alertDefinitionUID", middleware.ReqSignedIn, api.validateOrgAlertDefinition, routing.Wrap(api.getAlertDefinitionEndpoint))
		alertDefinitions.Delete("/:alertDefinitionUID", middleware.ReqEditorRole, api.validateOrgAlertDefinition, routing.Wrap(api.deleteAlertDefinitionEndpoint))
		alertDefinitions.Post("/", middleware.ReqEditorRole, binding.Bind(ngmodels.SaveAlertDefinitionCommand{}), routing.Wrap(api.createAlertDefinitionEndpoint))
		alertDefinitions.Put("/:alertDefinitionUID", middleware.ReqEditorRole, api.validateOrgAlertDefinition, binding.Bind(ngmodels.UpdateAlertDefinitionCommand{}), routing.Wrap(api.updateAlertDefinitionEndpoint))
		alertDefinitions.Post("/pause", middleware.ReqEditorRole, binding.Bind(ngmodels.UpdateAlertDefinitionPausedCommand{}), routing.Wrap(api.alertDefinitionPauseEndpoint))
		alertDefinitions.Post("/unpause", middleware.ReqEditorRole, binding.Bind(ngmodels.UpdateAlertDefinitionPausedCommand{}), routing.Wrap(api.alertDefinitionUnpauseEndpoint))
	})

	if api.Cfg.Env == setting.Dev {
		api.RouteRegister.Group("/api/alert-definitions", func(alertDefinitions routing.RouteRegister) {
			alertDefinitions.Post("/evalOld", middleware.ReqSignedIn, routing.Wrap(api.conditionEvalOldEndpoint))
		})
		api.RouteRegister.Group("/api/alert-definitions", func(alertDefinitions routing.RouteRegister) {
			alertDefinitions.Get("/evalOldByID/:id", middleware.ReqSignedIn, routing.Wrap(api.conditionEvalOldEndpointByID))
		})
		api.RouteRegister.Group("/api/alert-definitions", func(alertDefinitions routing.RouteRegister) {
			alertDefinitions.Get("/oldByID/:id", middleware.ReqSignedIn, routing.Wrap(api.conditionOldEndpointByID))
		})
		api.RouteRegister.Group("/api/alert-definitions", func(alertDefinitions routing.RouteRegister) {
			alertDefinitions.Get("/ruleGroupByOldID/:id", middleware.ReqSignedIn, routing.Wrap(api.ruleGroupByOldID))
		})
	}

	api.RouteRegister.Group("/api/ngalert/", func(schedulerRouter routing.RouteRegister) {
		schedulerRouter.Post("/pause", routing.Wrap(api.pauseScheduler))
		schedulerRouter.Post("/unpause", routing.Wrap(api.unpauseScheduler))
	}, middleware.ReqOrgAdmin)

	api.RouteRegister.Group("/api/alert-instances", func(alertInstances routing.RouteRegister) {
		alertInstances.Get("", middleware.ReqSignedIn, routing.Wrap(api.listAlertInstancesEndpoint))
	})
}
