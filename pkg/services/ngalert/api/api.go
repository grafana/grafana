package api

import (
	"context"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
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
	SaveAndApplyConfig(ctx context.Context, config *apimodels.PostableUserConfig) error
	SaveAndApplyDefaultConfig(ctx context.Context) error
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
	TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*notifier.TestReceiversResult, error)
}

type AlertingStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) error
}

// API handlers.
type API struct {
	Cfg                  *setting.Cfg
	DatasourceCache      datasources.CacheService
	RouteRegister        routing.RouteRegister
	ExpressionService    *expr.Service
	QuotaService         *quota.QuotaService
	Schedule             schedule.ScheduleService
	TransactionManager   provisioning.TransactionManager
	RuleStore            store.RuleStore
	InstanceStore        store.InstanceStore
	AlertingStore        AlertingStore
	AdminConfigStore     store.AdminConfigurationStore
	DataProxy            *datasourceproxy.DataSourceProxyService
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager
	StateManager         *state.Manager
	SecretsService       secrets.Service
	// LOGZ.IO GRAFANA CHANGE :: DEV-30705,DEV-30713 - Migration endpoints by org ID
	SQLStore *sqlstore.SQLStore
	// LOGZ.IO GRAFANA CHANGE :: end
	AccessControl       accesscontrol.AccessControl
	Policies            *provisioning.NotificationPolicyService
	ContactPointService *provisioning.ContactPointService
	AlertRules          *provisioning.AlertRuleService
}

// RegisterAPIEndpoints registers API handlers
func (api *API) RegisterAPIEndpoints(m *metrics.API) {
	logger := log.New("ngalert.api")
	proxy := &AlertingProxy{
		DataProxy: api.DataProxy,
	}

	// LOGZ.IO GRAFANA CHANGE :: DEV-34631 - Refactor query to retrieve visible namespaces for unified alerting rules
	logzioRuleStore := store.LogzioRuleStore{
		SQLStore: api.SQLStore,
	}
	// LOGZ.IO GRAFANA CHANGE :: end

	// Register endpoints for proxying to Alertmanager-compatible backends.
	api.RegisterAlertmanagerApiEndpoints(NewForkedAM(
		api.DatasourceCache,
		NewLotexAM(proxy, logger),
		&AlertmanagerSrv{crypto: api.MultiOrgAlertmanager.Crypto, log: logger, ac: api.AccessControl, mam: api.MultiOrgAlertmanager},
	), m)
	// Register endpoints for proxying to Prometheus-compatible backends.
	api.RegisterPrometheusApiEndpoints(NewForkedProm(
		api.DatasourceCache,
		NewLotexProm(proxy, logger),
		&PrometheusSrv{log: logger, manager: api.StateManager, store: api.RuleStore, ac: api.AccessControl, logzioRuleStore: logzioRuleStore}, // LOGZ.IO GRAFANA CHANGE :: DEV-34631 - Refactor query to retrieve visible namespaces for unified alerting rules
	), m)
	// Register endpoints for proxying to Cortex Ruler-compatible backends.
	api.RegisterRulerApiEndpoints(NewForkedRuler(
		api.DatasourceCache,
		NewLotexRuler(proxy, logger),
		&RulerSrv{
			DatasourceCache: api.DatasourceCache,
			QuotaService:    api.QuotaService,
			scheduleService: api.Schedule,
			store:           api.RuleStore,
			xactManager:     api.TransactionManager,
			log:             logger,
			cfg:             &api.Cfg.UnifiedAlerting,
			ac:              api.AccessControl,
			logzioRuleStore: logzioRuleStore, // LOGZ.IO GRAFANA CHANGE :: DEV-34631 - Refactor query to retrieve visible namespaces for unified alerting rules
		},
	), m)
	api.RegisterTestingApiEndpoints(NewForkedTestingApi(
		&TestingApiSrv{
			AlertingProxy:     proxy,
			ExpressionService: api.ExpressionService,
			DatasourceCache:   api.DatasourceCache,
			log:               logger,
			accessControl:     api.AccessControl,
			evaluator:         eval.NewEvaluator(api.Cfg, log.New("ngalert.eval"), api.DatasourceCache, api.SecretsService),
		}), m)
	api.RegisterConfigurationApiEndpoints(NewForkedConfiguration(
		&AdminSrv{
			store:     api.AdminConfigStore,
			log:       logger,
			scheduler: api.Schedule,
		},
	), m)
	// LOGZ.IO GRAFANA CHANGE :: DEV-30169,DEV-30170,DEV-30275: add logzio alerting endpoints
	api.RegisterLogzioAlertingApiEndpoints(NewLogzioAlertingApi(
		NewLogzioAlertingService(proxy,
			api.Cfg,
			eval.NewEvaluator(api.Cfg, logger, api.DatasourceCache, api.SecretsService),
			clock.New(),
			api.ExpressionService,
			api.StateManager,
			api.MultiOrgAlertmanager,
			api.InstanceStore,
			logger,
			api.SQLStore,
		),
	), m)
	// LOGZ.IO GRAFANA CHANGE :: end

	api.RegisterProvisioningApiEndpoints(NewForkedProvisioningApi(&ProvisioningSrv{
		log:                 logger,
		policies:            api.Policies,
		contactPointService: api.ContactPointService,
		alertRules:          api.AlertRules,
	}), m)
}
