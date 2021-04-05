package api

import (
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/expr/translate"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/util"
)

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

	return response.JSONStreaming(200, util.DynMap{
		"instances": []*data.Frame{&frame},
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

	return response.JSONStreaming(200, util.DynMap{
		"instances": []*data.Frame{&frame},
	})
}

// conditionEvalEndpoint handles POST /api/alert-definitions/evalOld.
func (api *API) conditionOldEndpointByID(c *models.ReqContext) response.Response {
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

	return response.JSON(200, evalCond)
}
