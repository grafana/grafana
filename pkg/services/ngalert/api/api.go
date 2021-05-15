package api

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/store"

	"github.com/go-macaron/binding"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/expr/translate"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/util"
)

// timeNow makes it possible to test usage of time
var timeNow = time.Now

// API handlers.
type API struct {
	Cfg             *setting.Cfg
	DatasourceCache datasources.CacheService
	RouteRegister   routing.RouteRegister
	DataService     *tsdb.Service
	Schedule        schedule.ScheduleService
	Store           store.Store
	DataProxy       *datasourceproxy.DatasourceProxyService
}

// RegisterAPIEndpoints registers API handlers
func (api *API) RegisterAPIEndpoints() {
	logger := log.New("ngalert.api")
	api.RegisterAlertmanagerApiEndpoints(AlertmanagerApiMock{log: logger})
	api.RegisterPrometheusApiEndpoints(PrometheusApiMock{log: logger})
	api.RegisterRulerApiEndpoints(NewForkedRuler(
		api.DatasourceCache,
		&LotexRuler{DataProxy: api.DataProxy, log: logger},
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

	api.RouteRegister.Group("/api/ngalert/", func(schedulerRouter routing.RouteRegister) {
		schedulerRouter.Post("/pause", routing.Wrap(api.pauseScheduler))
		schedulerRouter.Post("/unpause", routing.Wrap(api.unpauseScheduler))
	}, middleware.ReqOrgAdmin)

	api.RouteRegister.Group("/api/alert-instances", func(alertInstances routing.RouteRegister) {
		alertInstances.Get("", middleware.ReqSignedIn, routing.Wrap(api.listAlertInstancesEndpoint))
	})

	if api.Cfg.Env == setting.Dev {
		api.RouteRegister.Group("/api/alert-definitions", func(alertDefinitions routing.RouteRegister) {
			alertDefinitions.Post("/evalOld", middleware.ReqSignedIn, routing.Wrap(api.conditionEvalOldEndpoint))
		})
		api.RouteRegister.Group("/api/alert-definitions", func(alertDefinitions routing.RouteRegister) {
			alertDefinitions.Get("/evalOldByID/:id", middleware.ReqSignedIn, routing.Wrap(api.conditionEvalOldEndpointByID))
		})
	}
}

// conditionEvalEndpoint handles POST /api/alert-definitions/evalOld.
func (api *API) conditionEvalOldEndpoint(c *models.ReqContext) response.Response {
	b, err := c.Req.Body().Bytes()
	if err != nil {
		response.Error(400, "failed to read body", err)
	}
	evalCond, err := translate.DashboardAlertConditions(b, c.OrgId)
	if err != nil {
		return response.Error(400, "Failed to translate alert conditions", err)
	}

	if err := api.validateCondition(*evalCond, c.SignedInUser, c.SkipCache); err != nil {
		return response.Error(400, "invalid condition", err)
	}

	//now := cmd.Now
	//if now.IsZero() {
	//now := timeNow()
	//}

	evaluator := eval.Evaluator{Cfg: api.Cfg}
	evalResults, err := evaluator.ConditionEval(evalCond, timeNow(), api.DataService)
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

// conditionEvalEndpoint handles POST /api/alert-definitions/evalOld.
func (api *API) conditionEvalOldEndpointByID(c *models.ReqContext) response.Response {
	id := c.ParamsInt64("id")
	if id == 0 {
		return response.Error(400, "missing id", nil)
	}

	getAlert := &models.GetAlertByIdQuery{
		Id: id,
	}

	if err := bus.Dispatch(getAlert); err != nil {
		return response.Error(400, fmt.Sprintf("could find alert with id %v", id), err)
	}

	if getAlert.Result.OrgId != c.SignedInUser.OrgId {
		return response.Error(403, "alert does not match organization of user", nil)
	}

	settings := getAlert.Result.Settings

	sb, err := settings.ToDB()
	if err != nil {
		return response.Error(400, "failed to marshal alert settings", err)
	}

	evalCond, err := translate.DashboardAlertConditions(sb, c.OrgId)
	if err != nil {
		return response.Error(400, "Failed to translate alert conditions", err)
	}

	if err := api.validateCondition(*evalCond, c.SignedInUser, c.SkipCache); err != nil {
		return response.Error(400, "invalid condition", err)
	}

	//now := cmd.Now
	//if now.IsZero() {
	//now := timeNow()
	//}

	evaluator := eval.Evaluator{Cfg: api.Cfg}
	evalResults, err := evaluator.ConditionEval(evalCond, timeNow(), api.DataService)
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

// conditionEvalEndpoint handles POST /api/alert-definitions/eval.
func (api *API) conditionEvalEndpoint(c *models.ReqContext, cmd ngmodels.EvalAlertConditionCommand) response.Response {
	evalCond := ngmodels.Condition{
		RefID:                 cmd.Condition,
		OrgID:                 c.SignedInUser.OrgId,
		QueriesAndExpressions: cmd.Data,
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
		RefID:                 cmd.Condition,
		OrgID:                 c.SignedInUser.OrgId,
		QueriesAndExpressions: cmd.Data,
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
		RefID:                 cmd.Condition,
		OrgID:                 c.SignedInUser.OrgId,
		QueriesAndExpressions: cmd.Data,
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
		RefID:                 alertDefinition.Condition,
		OrgID:                 alertDefinition.OrgID,
		QueriesAndExpressions: alertDefinition.Data,
	}, nil
}

func (api *API) validateCondition(c ngmodels.Condition, user *models.SignedInUser, skipCache bool) error {
	var refID string

	if len(c.QueriesAndExpressions) == 0 {
		return nil
	}

	for _, query := range c.QueriesAndExpressions {
		if c.RefID == query.RefID {
			refID = c.RefID
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
		return fmt.Errorf("condition %s not found in any query or expression", c.RefID)
	}
	return nil
}
