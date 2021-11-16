package api

import (
	"context"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

// timeNow makes it possible to test usage of time
var timeNow = time.Now

type Scheduler interface {
	AlertmanagersFor(orgID int64) []*url.URL
	DroppedAlertmanagersFor(orgID int64) []*url.URL
}

type Alertmanager interface {
	// Configuration
	SaveAndApplyConfig(config *apimodels.PostableUserConfig) error
	SaveAndApplyDefaultConfig() error
	GetStatus() apimodels.GettableStatus

	// Silences
	CreateSilence(ps *apimodels.PostableSilence) (string, error)
	DeleteSilence(silenceID string) error
	GetSilence(silenceID string) (apimodels.GettableSilence, error)
	ListSilences(filter []string) (apimodels.GettableSilences, error)

	// Alerts
	GetAlerts(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.GettableAlerts, error)
	GetAlertGroups(active, silenced, inhibited bool, filter []string, receiver string) (apimodels.AlertGroups, error)

	// Testing
	TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigParams) (*notifier.TestReceiversResult, error)
}

// API handlers.
type API struct {
	Cfg                  *setting.Cfg
	DatasourceCache      datasources.CacheService
	RouteRegister        routing.RouteRegister
	ExpressionService    *expr.Service
	QuotaService         *quota.QuotaService
	Schedule             schedule.ScheduleService
	RuleStore            store.RuleStore
	InstanceStore        store.InstanceStore
	AlertingStore        store.AlertingStore
	AdminConfigStore     store.AdminConfigurationStore
	DataProxy            *datasourceproxy.DataSourceProxyService
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager
	StateManager         *state.Manager
	SecretsService       secrets.Service
}

// RegisterAPIEndpoints registers API handlers
func (api *API) RegisterAPIEndpoints(m *metrics.API) {
	logger := log.New("ngalert.api")
	proxy := &AlertingProxy{
		DataProxy: api.DataProxy,
	}

	// Register endpoints for proxying to Alertmanager-compatible backends.
	api.RegisterAlertmanagerApiEndpoints(NewForkedAM(
		api.DatasourceCache,
		NewLotexAM(proxy, logger),
		AlertmanagerSrv{store: api.AlertingStore, mam: api.MultiOrgAlertmanager, secrets: api.SecretsService, log: logger},
	), m)
	// Register endpoints for proxying to Prometheus-compatible backends.
	api.RegisterPrometheusApiEndpoints(NewForkedProm(
		api.DatasourceCache,
		NewLotexProm(proxy, logger),
		PrometheusSrv{log: logger, manager: api.StateManager, store: api.RuleStore},
	), m)
	// Register endpoints for proxying to Cortex Ruler-compatible backends.
	api.RegisterRulerApiEndpoints(NewForkedRuler(
		api.DatasourceCache,
		NewLotexRuler(proxy, logger),
		RulerSrv{DatasourceCache: api.DatasourceCache, QuotaService: api.QuotaService, manager: api.StateManager, store: api.RuleStore, log: logger},
	), m)
	api.RegisterTestingApiEndpoints(TestingApiSrv{
		AlertingProxy:     proxy,
		Cfg:               api.Cfg,
		ExpressionService: api.ExpressionService,
		DatasourceCache:   api.DatasourceCache,
		log:               logger,
	}, m)
	api.RegisterConfigurationApiEndpoints(AdminSrv{
		store:     api.AdminConfigStore,
		log:       logger,
		scheduler: api.Schedule,
	}, m)
}
