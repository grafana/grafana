package api

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

// listAlertInstancesEndpoint handles GET /api/alert-instances.
func (api *API) listAlertInstancesEndpoint(c *models.ReqContext) response.Response {
	cmd := ngmodels.ListAlertInstancesQuery{DefinitionOrgID: c.SignedInUser.OrgId}

	if err := api.Store.ListAlertInstances(&cmd); err != nil {
		return response.Error(500, "Failed to list alert instances", err)
	}

	return response.JSON(200, cmd.Result)
}

// conditionEvalEndpoint handles POST /api/alert-definitions/eval.
func (api *API) conditionEvalEndpoint(c *models.ReqContext, cmd ngmodels.EvalAlertConditionCommand) response.Response {
	return conditionEval(c, cmd, api.DatasourceCache, api.DataService, api.Cfg)
}

// alertDefinitionEvalEndpoint handles GET /api/alert-definitions/eval/:alertDefinitionUID.
func (api *API) alertDefinitionEvalEndpoint(c *models.ReqContext) response.Response {
	alertDefinitionUID := c.Params(":alertDefinitionUID")

	condition, err := api.LoadAlertCondition(alertDefinitionUID, c.SignedInUser.OrgId)
	if err != nil {
		return response.Error(400, "Failed to load alert definition conditions", err)
	}

	if err := validateCondition(*condition, c.SignedInUser, c.SkipCache, api.DatasourceCache); err != nil {
		return response.Error(400, "invalid condition", err)
	}

	evaluator := eval.Evaluator{Cfg: api.Cfg}
	evalResults, err := evaluator.ConditionEval(condition, timeNow(), api.DataService)
	if err != nil {
		return response.Error(400, "Failed to evaluate alert", err)
	}
	frame := evalResults.AsDataFrame()

	return response.JSONStreaming(200, util.DynMap{
		"instances": []*data.Frame{&frame},
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

	if err := validateCondition(evalCond, c.SignedInUser, c.SkipCache, api.DatasourceCache); err != nil {
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

	if err := validateCondition(evalCond, c.SignedInUser, c.SkipCache, api.DatasourceCache); err != nil {
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

func (api *API) validateOrgAlertDefinition(c *models.ReqContext) {
	uid := c.ParamsEscape(":alertDefinitionUID")

	if uid == "" {
		c.JsonApiErr(403, "Permission denied", nil)
		return
	}

	query := ngmodels.GetAlertDefinitionByUIDQuery{UID: uid, OrgID: c.SignedInUser.OrgId}

	if err := api.Store.GetAlertDefinitionByUID(&query); err != nil {
		c.JsonApiErr(404, "Alert definition not found", nil)
		return
	}
}
