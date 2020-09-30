package api

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	eval "github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/util"
)

// POST /api/alert-definitions/eval
func (hs *HTTPServer) AlertDefinitionEval(c *models.ReqContext, dto dtos.EvalAlertConditionsCommand) Response {
	alertCtx, cancelFn := context.WithTimeout(context.Background(), setting.AlertingEvaluationTimeout)
	defer cancelFn()

	alertExecCtx := eval.AlertExecCtx{Ctx: alertCtx, SignedInUser: c.SignedInUser}
	fromStr := "now-3h"
	toStr := "now"
	execResult, err := dto.Conditions.Execute(alertExecCtx, fromStr, toStr)
	if err != nil {
		return Error(400, "Failed to execute conditions", err)
	}

	evalResults, err := eval.EvaluateExecutionResult(execResult)
	if err != nil {
		return Error(400, "Failed to evaluate results", err)
	}

	frame := evalResults.AsDataFrame()
	df := tsdb.NewDecodedDataFrames([]*data.Frame{&frame})
	instances, err := df.Encoded()
	if err != nil {
		return Error(400, "Failed to encode result dataframes", err)
	}

	return JSON(200, util.DynMap{
		"instances": instances,
	})
}
