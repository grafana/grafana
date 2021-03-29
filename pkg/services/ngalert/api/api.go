package api

import (
	"fmt"
	"time"

	"github.com/go-macaron/binding"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/util"
)

// timeNow makes it possible to test usage of time
var timeNow = time.Now

type Alertmanager interface {
	ApplyConfig(config *apimodels.PostableUserConfig) error
}

// API handlers.
type API struct {
	Cfg             *setting.Cfg
	DatasourceCache datasources.CacheService
	RouteRegister   routing.RouteRegister
	DataService     *tsdb.Service
	Schedule        schedule.ScheduleService
	Store           store.Store
	DataProxy       *datasourceproxy.DatasourceProxyService
	Alertmanager    Alertmanager
}

// RegisterAPIEndpoints registers API handlers
func (api *API) RegisterAPIEndpoints() {
	logger := log.New("ngalert.api")
	proxy := &AlertingProxy{
		DataProxy: api.DataProxy,
	}
	api.RegisterAlertmanagerApiEndpoints(NewForkedAM(
		api.DatasourceCache,
		NewLotexAM(proxy, logger),
		AlertmanagerApiMock{log: logger},
	))
	api.RegisterPrometheusApiEndpoints(NewForkedProm(
		api.DatasourceCache,
		NewLotexProm(proxy, logger),
		PrometheusApiMock{log: logger},
	))
	api.RegisterRulerApiEndpoints(NewForkedRuler(
		api.DatasourceCache,
		NewLotexRuler(proxy, logger),
		RulerApiMock{log: logger},
	))
	api.RegisterTestingApiEndpoints(TestingApiMock{log: logger})

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
	}

	api.RouteRegister.Group("/api/ngalert/", func(schedulerRouter routing.RouteRegister) {
		schedulerRouter.Post("/pause", routing.Wrap(api.pauseScheduler))
		schedulerRouter.Post("/unpause", routing.Wrap(api.unpauseScheduler))
	}, middleware.ReqOrgAdmin)

	api.RouteRegister.Group("/api/alert-instances", func(alertInstances routing.RouteRegister) {
		alertInstances.Get("", middleware.ReqSignedIn, routing.Wrap(api.listAlertInstancesEndpoint))
	})
}

// conditionEvalEndpoint handles POST /api/alert-definitions/eval.
func (api *API) conditionEvalEndpoint(c *models.ReqContext, cmd ngmodels.EvalAlertConditionCommand) response.Response {
	evalCond := ngmodels.Condition{
		Condition: cmd.Condition,
		OrgID:     c.SignedInUser.OrgId,
		Data:      cmd.Data,
	}
	if err := api.validateCondition(evalCond, c.SignedInUser, c.SkipCache); err != nil {
		return response.Error(400, "invalid condition", err)
	}

	now := cmd.Now
	if now.IsZero() {
		now = timeNow()
	}

	evaluator := eval.Evaluator{Cfg: api.Cfg}
	evalResults, err := evaluator.ConditionEval(&evalCond, timeNow(), api.DataService)
	if err != nil {
		return response.Error(400, "Failed to evaluate conditions", err)
	}

	frame := evalResults.AsDataFrame()
	df := plugins.NewDecodedDataFrames([]*data.Frame{&frame})
	instances, err := df.Encoded()
	if err != nil {
		return response.Error(400, "Failed to encode result dataframes", err)
	}

	return response.JSON(200, util.DynMap{
		"instances": instances,
	})
}

// alertDefinitionEvalEndpoint handles GET /api/alert-definitions/eval/:alertDefinitionUID.
func (api *API) alertDefinitionEvalEndpoint(c *models.ReqContext) response.Response {
	alertDefinitionUID := c.Params(":alertDefinitionUID")

	condition, err := api.LoadAlertCondition(alertDefinitionUID, c.SignedInUser.OrgId)
	if err != nil {
		return response.Error(400, "Failed to load alert definition conditions", err)
	}

	if err := api.validateCondition(*condition, c.SignedInUser, c.SkipCache); err != nil {
		return response.Error(400, "invalid condition", err)
	}

	evaluator := eval.Evaluator{Cfg: api.Cfg}
	evalResults, err := evaluator.ConditionEval(condition, timeNow(), api.DataService)
	if err != nil {
		return response.Error(400, "Failed to evaluate alert", err)
	}
	frame := evalResults.AsDataFrame()

	df := plugins.NewDecodedDataFrames([]*data.Frame{&frame})
	if err != nil {
		return response.Error(400, "Failed to instantiate Dataframes from the decoded frames", err)
	}

	instances, err := df.Encoded()
	if err != nil {
		return response.Error(400, "Failed to encode result dataframes", err)
	}
	return response.JSON(200, util.DynMap{
		"instances": instances,
	})
}

// getAlertDefinitionEndpoint handles GET /api/alert-definitions/:alertDefinitionUID.
func (api *API) getAlertDefinitionEndpoint(c *models.ReqContext) response.Response {
	alertDefinitionUID := c.Params(":alertDefinitionUID")

	query := ngmodels.GetAlertDefinitionByUIDQuery{
		UID:   alertDefinitionUID,
		OrgID: c.SignedInUser.OrgId,
	}

	if err := api.Store.GetAlertDefinitionByUID(&query); err != nil {
		return response.Error(500, "Failed to get alert definition", err)
	}

	return response.JSON(200, &query.Result)
}

// deleteAlertDefinitionEndpoint handles DELETE /api/alert-definitions/:alertDefinitionUID.
func (api *API) deleteAlertDefinitionEndpoint(c *models.ReqContext) response.Response {
	alertDefinitionUID := c.Params(":alertDefinitionUID")

	cmd := ngmodels.DeleteAlertDefinitionByUIDCommand{
		UID:   alertDefinitionUID,
		OrgID: c.SignedInUser.OrgId,
	}

	if err := api.Store.DeleteAlertDefinitionByUID(&cmd); err != nil {
		return response.Error(500, "Failed to delete alert definition", err)
	}

	return response.Success("Alert definition deleted")
}

// updateAlertDefinitionEndpoint handles PUT /api/alert-definitions/:alertDefinitionUID.
func (api *API) updateAlertDefinitionEndpoint(c *models.ReqContext, cmd ngmodels.UpdateAlertDefinitionCommand) response.Response {
	cmd.UID = c.Params(":alertDefinitionUID")
	cmd.OrgID = c.SignedInUser.OrgId

	evalCond := ngmodels.Condition{
		Condition: cmd.Condition,
		OrgID:     c.SignedInUser.OrgId,
		Data:      cmd.Data,
	}
	if err := api.validateCondition(evalCond, c.SignedInUser, c.SkipCache); err != nil {
		return response.Error(400, "invalid condition", err)
	}

	if err := api.Store.UpdateAlertDefinition(&cmd); err != nil {
		return response.Error(500, "Failed to update alert definition", err)
	}

	return response.JSON(200, cmd.Result)
}

// createAlertDefinitionEndpoint handles POST /api/alert-definitions.
func (api *API) createAlertDefinitionEndpoint(c *models.ReqContext, cmd ngmodels.SaveAlertDefinitionCommand) response.Response {
	cmd.OrgID = c.SignedInUser.OrgId

	evalCond := ngmodels.Condition{
		Condition: cmd.Condition,
		OrgID:     c.SignedInUser.OrgId,
		Data:      cmd.Data,
	}
	if err := api.validateCondition(evalCond, c.SignedInUser, c.SkipCache); err != nil {
		return response.Error(400, "invalid condition", err)
	}

	if err := api.Store.SaveAlertDefinition(&cmd); err != nil {
		return response.Error(500, "Failed to create alert definition", err)
	}

	return response.JSON(200, cmd.Result)
}

// listAlertDefinitions handles GET /api/alert-definitions.
func (api *API) listAlertDefinitions(c *models.ReqContext) response.Response {
	query := ngmodels.ListAlertDefinitionsQuery{OrgID: c.SignedInUser.OrgId}

	if err := api.Store.GetOrgAlertDefinitions(&query); err != nil {
		return response.Error(500, "Failed to list alert definitions", err)
	}

	return response.JSON(200, util.DynMap{"results": query.Result})
}

func (api *API) pauseScheduler() response.Response {
	err := api.Schedule.Pause()
	if err != nil {
		return response.Error(500, "Failed to pause scheduler", err)
	}
	return response.JSON(200, util.DynMap{"message": "alert definition scheduler paused"})
}

func (api *API) unpauseScheduler() response.Response {
	err := api.Schedule.Unpause()
	if err != nil {
		return response.Error(500, "Failed to unpause scheduler", err)
	}
	return response.JSON(200, util.DynMap{"message": "alert definition scheduler unpaused"})
}

// alertDefinitionPauseEndpoint handles POST /api/alert-definitions/pause.
func (api *API) alertDefinitionPauseEndpoint(c *models.ReqContext, cmd ngmodels.UpdateAlertDefinitionPausedCommand) response.Response {
	cmd.OrgID = c.SignedInUser.OrgId
	cmd.Paused = true

	err := api.Store.UpdateAlertDefinitionPaused(&cmd)
	if err != nil {
		return response.Error(500, "Failed to pause alert definition", err)
	}
	return response.JSON(200, util.DynMap{"message": fmt.Sprintf("%d alert definitions paused", cmd.ResultCount)})
}

// alertDefinitionUnpauseEndpoint handles POST /api/alert-definitions/unpause.
func (api *API) alertDefinitionUnpauseEndpoint(c *models.ReqContext, cmd ngmodels.UpdateAlertDefinitionPausedCommand) response.Response {
	cmd.OrgID = c.SignedInUser.OrgId
	cmd.Paused = false

	err := api.Store.UpdateAlertDefinitionPaused(&cmd)
	if err != nil {
		return response.Error(500, "Failed to unpause alert definition", err)
	}
	return response.JSON(200, util.DynMap{"message": fmt.Sprintf("%d alert definitions unpaused", cmd.ResultCount)})
}

// LoadAlertCondition returns a Condition object for the given alertDefinitionID.
func (api *API) LoadAlertCondition(alertDefinitionUID string, orgID int64) (*ngmodels.Condition, error) {
	q := ngmodels.GetAlertDefinitionByUIDQuery{UID: alertDefinitionUID, OrgID: orgID}
	if err := api.Store.GetAlertDefinitionByUID(&q); err != nil {
		return nil, err
	}
	alertDefinition := q.Result

	err := api.Store.ValidateAlertDefinition(alertDefinition, true)
	if err != nil {
		return nil, err
	}

	return &ngmodels.Condition{
		Condition: alertDefinition.Condition,
		OrgID:     alertDefinition.OrgID,
		Data:      alertDefinition.Data,
	}, nil
}

func (api *API) validateCondition(c ngmodels.Condition, user *models.SignedInUser, skipCache bool) error {
	var refID string

	if len(c.Data) == 0 {
		return nil
	}

	for _, query := range c.Data {
		if c.Condition == query.RefID {
			refID = c.Condition
		}

		datasourceUID, err := query.GetDatasource()
		if err != nil {
			return err
		}

		isExpression, err := query.IsExpression()
		if err != nil {
			return err
		}
		if isExpression {
			continue
		}

		_, err = api.DatasourceCache.GetDatasourceByUID(datasourceUID, user, skipCache)
		if err != nil {
			return fmt.Errorf("failed to get datasource: %s: %w", datasourceUID, err)
		}
	}

	if refID == "" {
		return fmt.Errorf("condition %s not found in any query or expression", c.Condition)
	}
	return nil
}
