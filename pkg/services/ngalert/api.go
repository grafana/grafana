package ngalert

import (
	"fmt"

	"github.com/go-macaron/binding"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/util"
)

func (ng *AlertNG) registerAPIEndpoints() {
	ng.RouteRegister.Group("/api/alert-definitions", func(alertDefinitions routing.RouteRegister) {
		alertDefinitions.Get("", middleware.ReqSignedIn, routing.Wrap(ng.listAlertDefinitions))
		alertDefinitions.Get("/eval/:alertDefinitionUID", middleware.ReqSignedIn, ng.validateOrgAlertDefinition, routing.Wrap(ng.alertDefinitionEvalEndpoint))
		alertDefinitions.Post("/eval", middleware.ReqSignedIn, binding.Bind(evalAlertConditionCommand{}), routing.Wrap(ng.conditionEvalEndpoint))
		alertDefinitions.Get("/:alertDefinitionUID", middleware.ReqSignedIn, ng.validateOrgAlertDefinition, routing.Wrap(ng.getAlertDefinitionEndpoint))
		alertDefinitions.Delete("/:alertDefinitionUID", middleware.ReqEditorRole, ng.validateOrgAlertDefinition, routing.Wrap(ng.deleteAlertDefinitionEndpoint))
		alertDefinitions.Post("/", middleware.ReqEditorRole, binding.Bind(saveAlertDefinitionCommand{}), routing.Wrap(ng.createAlertDefinitionEndpoint))
		alertDefinitions.Put("/:alertDefinitionUID", middleware.ReqEditorRole, ng.validateOrgAlertDefinition, binding.Bind(updateAlertDefinitionCommand{}), routing.Wrap(ng.updateAlertDefinitionEndpoint))
		alertDefinitions.Post("/pause", middleware.ReqEditorRole, binding.Bind(updateAlertDefinitionPausedCommand{}), routing.Wrap(ng.alertDefinitionPauseEndpoint))
		alertDefinitions.Post("/unpause", middleware.ReqEditorRole, binding.Bind(updateAlertDefinitionPausedCommand{}), routing.Wrap(ng.alertDefinitionUnpauseEndpoint))
	})

	ng.RouteRegister.Group("/api/ngalert/", func(schedulerRouter routing.RouteRegister) {
		schedulerRouter.Post("/pause", routing.Wrap(ng.pauseScheduler))
		schedulerRouter.Post("/unpause", routing.Wrap(ng.unpauseScheduler))
	}, middleware.ReqOrgAdmin)

	ng.RouteRegister.Group("/api/alert-instances", func(alertInstances routing.RouteRegister) {
		alertInstances.Get("", middleware.ReqSignedIn, routing.Wrap(ng.listAlertInstancesEndpoint))
	})
}

// conditionEvalEndpoint handles POST /api/alert-definitions/eval.
func (ng *AlertNG) conditionEvalEndpoint(c *models.ReqContext, cmd evalAlertConditionCommand) response.Response {
	evalCond := eval.Condition{
		RefID:                 cmd.Condition,
		OrgID:                 c.SignedInUser.OrgId,
		QueriesAndExpressions: cmd.Data,
	}
	if err := ng.validateCondition(evalCond, c.SignedInUser, c.SkipCache); err != nil {
		return response.Error(400, "invalid condition", err)
	}

	now := cmd.Now
	if now.IsZero() {
		now = timeNow()
	}

	evaluator := eval.Evaluator{Cfg: ng.Cfg}

	evalResults, err := evaluator.ConditionEval(&evalCond, now)
	if err != nil {
		return response.Error(400, "Failed to evaluate conditions", err)
	}

	frame := evalResults.AsDataFrame()
	df := tsdb.NewDecodedDataFrames([]*data.Frame{&frame})
	instances, err := df.Encoded()
	if err != nil {
		return response.Error(400, "Failed to encode result dataframes", err)
	}

	return response.JSON(200, util.DynMap{
		"instances": instances,
	})
}

// alertDefinitionEvalEndpoint handles POST /api/alert-definitions/eval/:alertDefinitionUID.
func (ng *AlertNG) alertDefinitionEvalEndpoint(c *models.ReqContext) response.Response {
	alertDefinitionUID := c.Params(":alertDefinitionUID")

	condition, err := ng.LoadAlertCondition(alertDefinitionUID, c.SignedInUser.OrgId)
	if err != nil {
		return response.Error(400, "Failed to load alert definition conditions", err)
	}

	if err := ng.validateCondition(*condition, c.SignedInUser, c.SkipCache); err != nil {
		return response.Error(400, "invalid condition", err)
	}

	evaluator := eval.Evaluator{Cfg: ng.Cfg}
	evalResults, err := evaluator.ConditionEval(condition, timeNow())
	if err != nil {
		return response.Error(400, "Failed to evaluate alert", err)
	}
	frame := evalResults.AsDataFrame()

	df := tsdb.NewDecodedDataFrames([]*data.Frame{&frame})
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
func (ng *AlertNG) getAlertDefinitionEndpoint(c *models.ReqContext) response.Response {
	alertDefinitionUID := c.Params(":alertDefinitionUID")

	query := getAlertDefinitionByUIDQuery{
		UID:   alertDefinitionUID,
		OrgID: c.SignedInUser.OrgId,
	}

	if err := ng.getAlertDefinitionByUID(&query); err != nil {
		return response.Error(500, "Failed to get alert definition", err)
	}

	return response.JSON(200, &query.Result)
}

// deleteAlertDefinitionEndpoint handles DELETE /api/alert-definitions/:alertDefinitionUID.
func (ng *AlertNG) deleteAlertDefinitionEndpoint(c *models.ReqContext) response.Response {
	alertDefinitionUID := c.Params(":alertDefinitionUID")

	cmd := deleteAlertDefinitionByUIDCommand{
		UID:   alertDefinitionUID,
		OrgID: c.SignedInUser.OrgId,
	}

	if err := ng.deleteAlertDefinitionByUID(&cmd); err != nil {
		return response.Error(500, "Failed to delete alert definition", err)
	}

	return response.Success("Alert definition deleted")
}

// updateAlertDefinitionEndpoint handles PUT /api/alert-definitions/:alertDefinitionUID.
func (ng *AlertNG) updateAlertDefinitionEndpoint(c *models.ReqContext, cmd updateAlertDefinitionCommand) response.Response {
	cmd.UID = c.Params(":alertDefinitionUID")
	cmd.OrgID = c.SignedInUser.OrgId

	evalCond := eval.Condition{
		RefID:                 cmd.Condition,
		OrgID:                 c.SignedInUser.OrgId,
		QueriesAndExpressions: cmd.Data,
	}
	if err := ng.validateCondition(evalCond, c.SignedInUser, c.SkipCache); err != nil {
		return response.Error(400, "invalid condition", err)
	}

	if err := ng.updateAlertDefinition(&cmd); err != nil {
		return response.Error(500, "Failed to update alert definition", err)
	}

	return response.JSON(200, cmd.Result)
}

// createAlertDefinitionEndpoint handles POST /api/alert-definitions.
func (ng *AlertNG) createAlertDefinitionEndpoint(c *models.ReqContext, cmd saveAlertDefinitionCommand) response.Response {
	cmd.OrgID = c.SignedInUser.OrgId

	evalCond := eval.Condition{
		RefID:                 cmd.Condition,
		OrgID:                 c.SignedInUser.OrgId,
		QueriesAndExpressions: cmd.Data,
	}
	if err := ng.validateCondition(evalCond, c.SignedInUser, c.SkipCache); err != nil {
		return response.Error(400, "invalid condition", err)
	}

	if err := ng.saveAlertDefinition(&cmd); err != nil {
		return response.Error(500, "Failed to create alert definition", err)
	}

	return response.JSON(200, cmd.Result)
}

// listAlertDefinitions handles GET /api/alert-definitions.
func (ng *AlertNG) listAlertDefinitions(c *models.ReqContext) response.Response {
	query := listAlertDefinitionsQuery{OrgID: c.SignedInUser.OrgId}

	if err := ng.getOrgAlertDefinitions(&query); err != nil {
		return response.Error(500, "Failed to list alert definitions", err)
	}

	return response.JSON(200, util.DynMap{"results": query.Result})
}

func (ng *AlertNG) pauseScheduler() response.Response {
	err := ng.schedule.pause()
	if err != nil {
		return response.Error(500, "Failed to pause scheduler", err)
	}
	return response.JSON(200, util.DynMap{"message": "alert definition scheduler paused"})
}

func (ng *AlertNG) unpauseScheduler() response.Response {
	err := ng.schedule.unpause()
	if err != nil {
		return response.Error(500, "Failed to unpause scheduler", err)
	}
	return response.JSON(200, util.DynMap{"message": "alert definition scheduler unpaused"})
}

// alertDefinitionPauseEndpoint handles POST /api/alert-definitions/pause.
func (ng *AlertNG) alertDefinitionPauseEndpoint(c *models.ReqContext, cmd updateAlertDefinitionPausedCommand) response.Response {
	cmd.OrgID = c.SignedInUser.OrgId
	cmd.Paused = true

	err := ng.updateAlertDefinitionPaused(&cmd)
	if err != nil {
		return response.Error(500, "Failed to pause alert definition", err)
	}
	return response.JSON(200, util.DynMap{"message": fmt.Sprintf("%d alert definitions paused", cmd.ResultCount)})
}

// alertDefinitionUnpauseEndpoint handles POST /api/alert-definitions/unpause.
func (ng *AlertNG) alertDefinitionUnpauseEndpoint(c *models.ReqContext, cmd updateAlertDefinitionPausedCommand) response.Response {
	cmd.OrgID = c.SignedInUser.OrgId
	cmd.Paused = false

	err := ng.updateAlertDefinitionPaused(&cmd)
	if err != nil {
		return response.Error(500, "Failed to unpause alert definition", err)
	}
	return response.JSON(200, util.DynMap{"message": fmt.Sprintf("%d alert definitions unpaused", cmd.ResultCount)})
}
