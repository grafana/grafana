package api

import (
	"context"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/backtesting"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
)

// timeNow makes it possible to test usage of time
var timeNow = time.Now

type ExternalAlertmanagerProvider interface {
	AlertmanagersFor(orgID int64) []*url.URL
	DroppedAlertmanagersFor(orgID int64) []*url.URL
}

type AlertingStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error)
}

type RuleAccessControlService interface {
	HasAccessToRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) (bool, error)
	AuthorizeAccessToRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) error
	AuthorizeRuleChanges(ctx context.Context, user identity.Requester, change *store.GroupDelta) error
	AuthorizeDatasourceAccessForRule(ctx context.Context, user identity.Requester, rule *models.AlertRule) error
	AuthorizeDatasourceAccessForRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) error
	AuthorizeAccessInFolder(ctx context.Context, user identity.Requester, namespaced models.Namespaced) error
}

// API handlers.
type API struct {
	Cfg                  *setting.Cfg
	DatasourceCache      datasources.CacheService
	DatasourceService    datasources.DataSourceService
	RouteRegister        routing.RouteRegister
	QuotaService         quota.Service
	TransactionManager   provisioning.TransactionManager
	ProvenanceStore      provisioning.ProvisioningStore
	RuleStore            RuleStore
	AlertingStore        store.AlertingStore
	AdminConfigStore     store.AdminConfigurationStore
	DataProxy            *datasourceproxy.DataSourceProxyService
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager
	StateManager         *state.Manager
	Scheduler            StatusReader
	AccessControl        ac.AccessControl
	Policies             *provisioning.NotificationPolicyService
	ReceiverService      *notifier.ReceiverService
	ContactPointService  *provisioning.ContactPointService
	Templates            *provisioning.TemplateService
	MuteTimings          *provisioning.MuteTimingService
	AlertRules           *provisioning.AlertRuleService
	AlertsRouter         *sender.AlertsRouter
	EvaluatorFactory     eval.EvaluatorFactory
	ConditionValidator   *eval.ConditionValidator
	FeatureManager       featuremgmt.FeatureToggles
	Historian            Historian
	Tracer               tracing.Tracer
	AppUrl               *url.URL

	// Hooks can be used to replace API handlers for specific paths.
	Hooks *Hooks
}

// RegisterAPIEndpoints registers API handlers
func (api *API) RegisterAPIEndpoints(m *metrics.API) {
	logger := log.New("ngalert.api")
	proxy := &AlertingProxy{
		DataProxy: api.DataProxy,
		ac:        api.AccessControl,
	}
	ruleAuthzService := accesscontrol.NewRuleService(api.AccessControl)

	// Register endpoints for proxying to Alertmanager-compatible backends.
	api.RegisterAlertmanagerApiEndpoints(NewForkingAM(
		api.DatasourceCache,
		NewLotexAM(proxy, logger),
		&AlertmanagerSrv{
			crypto:         api.MultiOrgAlertmanager.Crypto,
			log:            logger,
			ac:             api.AccessControl,
			mam:            api.MultiOrgAlertmanager,
			featureManager: api.FeatureManager,
			silenceSvc: notifier.NewSilenceService(
				accesscontrol.NewSilenceService(api.AccessControl, api.RuleStore),
				api.TransactionManager,
				logger,
				api.MultiOrgAlertmanager,
				api.RuleStore,
				ruleAuthzService,
			),
		},
	), m)
	// Register endpoints for proxying to Prometheus-compatible backends.
	api.RegisterPrometheusApiEndpoints(NewForkingProm(
		api.DatasourceCache,
		NewLotexProm(proxy, logger),
		&PrometheusSrv{log: logger, manager: api.StateManager, status: api.Scheduler, store: api.RuleStore, authz: ruleAuthzService},
	), m)
	// Register endpoints for proxying to Cortex Ruler-compatible backends.
	api.RegisterRulerApiEndpoints(NewForkingRuler(
		api.DatasourceCache,
		NewLotexRuler(proxy, logger),
		&RulerSrv{
			conditionValidator: api.ConditionValidator,
			QuotaService:       api.QuotaService,
			store:              api.RuleStore,
			provenanceStore:    api.ProvenanceStore,
			xactManager:        api.TransactionManager,
			log:                logger,
			cfg:                &api.Cfg.UnifiedAlerting,
			authz:              ruleAuthzService,
			amConfigStore:      api.AlertingStore,
			amRefresher:        api.MultiOrgAlertmanager,
			featureManager:     api.FeatureManager,
		},
	), m)
	api.RegisterTestingApiEndpoints(NewTestingApi(
		&TestingApiSrv{
			AlertingProxy:   proxy,
			DatasourceCache: api.DatasourceCache,
			log:             logger,
			authz:           ruleAuthzService,
			evaluator:       api.EvaluatorFactory,
			cfg:             &api.Cfg.UnifiedAlerting,
			backtesting:     backtesting.NewEngine(api.AppUrl, api.EvaluatorFactory, api.Tracer),
			featureManager:  api.FeatureManager,
			appUrl:          api.AppUrl,
			tracer:          api.Tracer,
			folderService:   api.RuleStore,
		}), m)
	api.RegisterConfigurationApiEndpoints(NewConfiguration(
		&ConfigSrv{
			datasourceService:    api.DatasourceService,
			store:                api.AdminConfigStore,
			log:                  logger,
			alertmanagerProvider: api.AlertsRouter,
			featureManager:       api.FeatureManager,
		},
	), m)

	api.RegisterProvisioningApiEndpoints(NewProvisioningApi(&ProvisioningSrv{
		log:                 logger,
		policies:            api.Policies,
		contactPointService: api.ContactPointService,
		templates:           api.Templates,
		muteTimings:         api.MuteTimings,
		alertRules:          api.AlertRules,
		// XXX: Used to flag recording rules, remove when FT is removed
		featureManager: api.FeatureManager,
	}), m)

	api.RegisterHistoryApiEndpoints(NewStateHistoryApi(&HistorySrv{
		logger: logger,
		hist:   api.Historian,
	}), m)

	api.RegisterNotificationsApiEndpoints(NewNotificationsApi(&NotificationSrv{
		logger:            logger,
		receiverService:   api.ReceiverService,
		muteTimingService: api.MuteTimings,
	}), m)
}
