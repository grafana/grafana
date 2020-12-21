package ngalert

import (
	"github.com/go-macaron/binding"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/util"
)

func (ng *AlertNG) registerAPIEndpoints() {
	ng.RouteRegister.Group("/api/alert-definitions", func(alertDefinitions routing.RouteRegister) {
		alertDefinitions.Get("", middleware.ReqSignedIn, api.Wrap(ng.listAlertDefinitions))
		alertDefinitions.Get("/eval/:alertDefinitionId", ng.validateOrgAlertDefinition, api.Wrap(ng.alertDefinitionEvalEndpoint))
		alertDefinitions.Post("/eval", middleware.ReqSignedIn, binding.Bind(evalAlertConditionCommand{}), api.Wrap(ng.conditionEvalEndpoint))
		alertDefinitions.Get("/:alertDefinitionId", ng.validateOrgAlertDefinition, api.Wrap(ng.getAlertDefinitionEndpoint))
		alertDefinitions.Delete("/:alertDefinitionId", ng.validateOrgAlertDefinition, api.Wrap(ng.deleteAlertDefinitionEndpoint))
		alertDefinitions.Post("/", middleware.ReqSignedIn, binding.Bind(saveAlertDefinitionCommand{}), api.Wrap(ng.createAlertDefinitionEndpoint))
		alertDefinitions.Put("/:alertDefinitionId", ng.validateOrgAlertDefinition, binding.Bind(updateAlertDefinitionCommand{}), api.Wrap(ng.updateAlertDefinitionEndpoint))
	})

	ng.RouteRegister.Group("/api/ngalert/", func(schedulerRouter routing.RouteRegister) {
		schedulerRouter.Post("/pause", api.Wrap(ng.pauseScheduler))
		schedulerRouter.Post("/unpause", api.Wrap(ng.unpauseScheduler))
	}, middleware.ReqOrgAdmin)
}

// conditionEvalEndpoint handles POST /api/alert-definitions/eval.
func (ng *AlertNG) conditionEvalEndpoint(c *models.ReqContext, dto evalAlertConditionCommand) api.Response {
	if err := ng.validateCondition(dto.Condition, c.SignedInUser); err != nil {
		return api.Error(400, "invalid condition", err)
	}

	evalResults, err := eval.ConditionEval(&dto.Condition, timeNow())
	if err != nil {
		return api.Error(400, "Failed to evaluate conditions", err)
	}

	frame := evalResults.AsDataFrame()
	df := tsdb.NewDecodedDataFrames([]*data.Frame{&frame})
	instances, err := df.Encoded()
	if err != nil {
		return api.Error(400, "Failed to encode result dataframes", err)
	}

	return api.JSON(200, util.DynMap{
		"instances": instances,
	})
}

// alertDefinitionEvalEndpoint handles GET /api/alert-definitions/eval/:dashboardId/:panelId/:refId".
func (ng *AlertNG) alertDefinitionEvalEndpoint(c *models.ReqContext) api.Response {
	alertDefinitionID := c.ParamsInt64(":alertDefinitionId")

	condition, err := ng.LoadAlertCondition(alertDefinitionID)
	if err != nil {
		return api.Error(400, "Failed to load alert definition conditions", err)
	}

	if err := ng.validateCondition(*condition, c.SignedInUser); err != nil {
		return api.Error(400, "invalid condition", err)
	}

	evalResults, err := eval.ConditionEval(condition, timeNow())
	if err != nil {
		return api.Error(400, "Failed to evaludate alert", err)
	}
	frame := evalResults.AsDataFrame()

	df := tsdb.NewDecodedDataFrames([]*data.Frame{&frame})
	if err != nil {
		return api.Error(400, "Failed to instantiate Dataframes from the decoded frames", err)
	}

	instances, err := df.Encoded()
	if err != nil {
		return api.Error(400, "Failed to encode result dataframes", err)
	}
	return api.JSON(200, util.DynMap{
		"instances": instances,
	})
}

// getAlertDefinitionEndpoint handles GET /api/alert-definitions/:alertDefinitionId.
func (ng *AlertNG) getAlertDefinitionEndpoint(c *models.ReqContext) api.Response {
	alertDefinitionID := c.ParamsInt64(":alertDefinitionId")

	query := getAlertDefinitionByIDQuery{
		ID: alertDefinitionID,
	}

	if err := ng.getAlertDefinitionByID(&query); err != nil {
		return api.Error(500, "Failed to get alert definition", err)
	}

	return api.JSON(200, &query.Result)
}

// deleteAlertDefinitionEndpoint handles DELETE /api/alert-definitions/:alertDefinitionId.
func (ng *AlertNG) deleteAlertDefinitionEndpoint(c *models.ReqContext) api.Response {
	alertDefinitionID := c.ParamsInt64(":alertDefinitionId")

	cmd := deleteAlertDefinitionByIDCommand{
		ID:    alertDefinitionID,
		OrgID: c.SignedInUser.OrgId,
	}

	if err := ng.deleteAlertDefinitionByID(&cmd); err != nil {
		return api.Error(500, "Failed to delete alert definition", err)
	}

	if cmd.RowsAffected != 1 {
		ng.log.Warn("unexpected number of rows affected on alert definition delete", "definitionID", alertDefinitionID, "rowsAffected", cmd.RowsAffected)
	}

	return api.Success("Alert definition deleted")
}

// updateAlertDefinitionEndpoint handles PUT /api/alert-definitions/:alertDefinitionId.
func (ng *AlertNG) updateAlertDefinitionEndpoint(c *models.ReqContext, cmd updateAlertDefinitionCommand) api.Response {
	cmd.ID = c.ParamsInt64(":alertDefinitionId")
	cmd.OrgID = c.SignedInUser.OrgId

	if err := ng.validateCondition(cmd.Condition, c.SignedInUser); err != nil {
		return api.Error(400, "invalid condition", err)
	}

	if err := ng.updateAlertDefinition(&cmd); err != nil {
		return api.Error(500, "Failed to update alert definition", err)
	}

	if cmd.RowsAffected != 1 {
		ng.log.Warn("unexpected number of rows affected on alert definition update", "definitionID", cmd.ID, "rowsAffected", cmd.RowsAffected)
	}

	return api.Success("Alert definition updated")
}

// createAlertDefinitionEndpoint handles POST /api/alert-definitions.
func (ng *AlertNG) createAlertDefinitionEndpoint(c *models.ReqContext, cmd saveAlertDefinitionCommand) api.Response {
	cmd.OrgID = c.SignedInUser.OrgId

	if err := ng.validateCondition(cmd.Condition, c.SignedInUser); err != nil {
		return api.Error(400, "invalid condition", err)
	}

	if err := ng.saveAlertDefinition(&cmd); err != nil {
		return api.Error(500, "Failed to create alert definition", err)
	}

	return api.JSON(200, util.DynMap{"id": cmd.Result.ID})
}

// listAlertDefinitions handles GET /api/alert-definitions.
func (ng *AlertNG) listAlertDefinitions(c *models.ReqContext) api.Response {
	query := listAlertDefinitionsQuery{OrgID: c.SignedInUser.OrgId}

	if err := ng.getOrgAlertDefinitions(&query); err != nil {
		return api.Error(500, "Failed to list alert definitions", err)
	}

	return api.JSON(200, util.DynMap{"results": query.Result})
}

func (ng *AlertNG) pauseScheduler() api.Response {
	err := ng.schedule.pause()
	if err != nil {
		return api.Error(500, "Failed to pause scheduler", err)
	}
	return api.JSON(200, util.DynMap{"message": "alert definition scheduler paused"})
}

func (ng *AlertNG) unpauseScheduler() api.Response {
	err := ng.schedule.unpause()
	if err != nil {
		return api.Error(500, "Failed to unpause scheduler", err)
	}
	return api.JSON(200, util.DynMap{"message": "alert definition scheduler unpaused"})
}
