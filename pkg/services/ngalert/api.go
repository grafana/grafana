package ngalert

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"

	"github.com/go-macaron/binding"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
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
}

// conditionEvalEndpoint handles POST /api/alert-definitions/eval.
func (ng *AlertNG) conditionEvalEndpoint(c *models.ReqContext, dto evalAlertConditionCommand) api.Response {
	alertCtx, cancelFn := context.WithTimeout(context.Background(), setting.AlertingEvaluationTimeout)
	defer cancelFn()

	alertExecCtx := eval.AlertExecCtx{Ctx: alertCtx}

	execResult, err := dto.Condition.Execute(alertExecCtx, timeNow())
	if err != nil {
		return api.Error(400, "Failed to execute conditions", err)
	}

	evalResults, err := eval.EvaluateExecutionResult(execResult)
	if err != nil {
		return api.Error(400, "Failed to evaluate results", err)
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

	evalResults, err := ng.alertDefinitionEval(alertDefinitionID, timeNow())
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

func (ng *AlertNG) alertDefinitionEval(alertDefinitionID int64, now time.Time) (eval.Results, error) {
	conditions, err := ng.LoadAlertCondition(alertDefinitionID)
	if err != nil {
		return nil, fmt.Errorf("failed to load conditions: %w", err)
	}

	alertCtx, cancelFn := context.WithTimeout(context.Background(), setting.AlertingEvaluationTimeout)
	defer cancelFn()

	alertExecCtx := eval.AlertExecCtx{AlertDefitionID: alertDefinitionID, Ctx: alertCtx}

	execResult, err := conditions.Execute(alertExecCtx, now)
	if err != nil {
		return nil, fmt.Errorf("failed to execute conditions: %w", err)
	}

	evalResults, err := eval.EvaluateExecutionResult(execResult)
	if err != nil {
		return nil, fmt.Errorf("failed to evaluate results: %w", err)
	}
	return evalResults, nil
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

	query := deleteAlertDefinitionByIDCommand{
		ID:    alertDefinitionID,
		OrgID: c.SignedInUser.OrgId,
	}

	if err := ng.deleteAlertDefinitionByID(&query); err != nil {
		return api.Error(500, "Failed to delete alert definition", err)
	}

	return api.JSON(200, util.DynMap{"affectedRows": query.RowsAffected})
}

// updateAlertDefinitionEndpoint handles PUT /api/alert-definitions/:alertDefinitionId.
func (ng *AlertNG) updateAlertDefinitionEndpoint(c *models.ReqContext, cmd updateAlertDefinitionCommand) api.Response {
	cmd.ID = c.ParamsInt64(":alertDefinitionId")

	if err := ng.updateAlertDefinition(&cmd); err != nil {
		return api.Error(500, "Failed to update alert definition", err)
	}

	return api.JSON(200, util.DynMap{"affectedRows": cmd.RowsAffected, "id": cmd.Result.Id})
}

// createAlertDefinitionEndpoint handles POST /api/alert-definitions.
func (ng *AlertNG) createAlertDefinitionEndpoint(c *models.ReqContext, cmd saveAlertDefinitionCommand) api.Response {
	cmd.OrgID = c.SignedInUser.OrgId

	if err := ng.saveAlertDefinition(&cmd); err != nil {
		return api.Error(500, "Failed to create alert definition", err)
	}

	return api.JSON(200, util.DynMap{"id": cmd.Result.Id})
}

// listAlertDefinitions handles GET /api/alert-definitions.
func (ng *AlertNG) listAlertDefinitions(c *models.ReqContext) api.Response {
	query := listAlertDefinitionsQuery{OrgID: c.SignedInUser.OrgId}

	if err := ng.getOrgAlertDefinitions(&query); err != nil {
		return api.Error(500, "Failed to list alert definitions", err)
	}

	return api.JSON(200, util.DynMap{"results": query.Result})
}
