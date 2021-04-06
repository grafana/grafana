package api

import (
	"fmt"
	"time"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/expr/translate"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/common/model"
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

// conditionEvalEndpoint handles POST /api/alert-definitions/oldByID.
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

// ruleGroupByOldID handles POST /api/alert-definitions/ruleGroupByOldID.
func (api *API) ruleGroupByOldID(c *models.ReqContext) response.Response {
	id := c.ParamsInt64("id")
	if id == 0 {
		return response.Error(400, "missing id", nil)
	}

	save := c.Query("save") == "true"

	getAlert := &models.GetAlertByIdQuery{
		Id: id,
	}

	if err := bus.Dispatch(getAlert); err != nil {
		return response.Error(400, fmt.Sprintf("could find alert with id %v", id), err)
	}

	if getAlert.Result.OrgId != c.SignedInUser.OrgId {
		return response.Error(403, "alert does not match organization of user", nil)
	}

	oldAlert := getAlert.Result

	sb, err := oldAlert.Settings.ToDB()
	if err != nil {
		return response.Error(400, "failed to marshal alert settings", err)
	}

	evalCond, err := translate.DashboardAlertConditions(sb, c.OrgId)
	if err != nil {
		return response.Error(400, "Failed to translate alert conditions", err)
	}

	getDash := &models.GetDashboardQuery{
		Id:    getAlert.Result.DashboardId,
		OrgId: getAlert.Result.OrgId,
	}
	if err := bus.Dispatch(getDash); err != nil {
		return response.Error(400, fmt.Sprintf("could find dashboard %v for alert with id %v", getDash.Id, id), err)
	}

	isGeneralFolder := getDash.Result.FolderId == 0 && !getDash.Result.IsFolder

	var namespaceUID string

	if isGeneralFolder {
		namespaceUID = "General"
	} else {
		getFolder := &models.GetDashboardQuery{
			Id:    getDash.Result.FolderId,
			OrgId: getDash.Result.OrgId,
		}
		if err := bus.Dispatch(getFolder); err != nil {
			return response.Error(400, fmt.Sprintf("could find folder %v for alert with id %v", getFolder.Id, id), err)
		}

		namespaceUID = getFolder.Result.Uid
	}

	oldNoData := oldAlert.Settings.Get("noDataState").MustString()
	noDataSetting, err := transNoData(oldNoData)
	if err != nil {
		return response.Error(400, "unrecognized no data option", err)
	}

	oldExecErr := oldAlert.Settings.Get("executionErrorState").MustString()
	execErrSetting, err := transExecErr(oldExecErr)
	if err != nil {
		return response.Error(400, "unrecognized execution error option", err)
	}

	// TODO: What to do with Rule Tags
	// ruleTags := map[string]string{}

	// for k, v := range oldAlert.Settings.Get("alertRuleTags").MustMap() {
	// 	sV, ok := v.(string)
	// 	if !ok {
	// 		return response.Error(400, "unable to unmarshal rule tags",
	// 			fmt.Errorf("unexpected type %T for tag %v", v, k))
	// 	}
	// 	ruleTags[k] = sV
	// }

	// spew.Dump(ruleTags)

	// TODO: Need place to put FOR duration

	rule := ngmodels.AlertRule{
		Title:        oldAlert.Name,
		Data:         evalCond.Data,
		Condition:    evalCond.Condition,
		NoDataState:  noDataSetting,
		ExecErrState: execErrSetting,
	}

	rgc := apimodels.PostableRuleGroupConfig{
		// TODO? Generate new name on conflict?
		Name:     oldAlert.Name,
		Interval: adjustInterval(oldAlert.Frequency),
		Rules: []apimodels.PostableExtendedRuleNode{
			toPostableExtendedRuleNode(rule),
		},
	}

	cmd := store.UpdateRuleGroupCmd{
		OrgID:           oldAlert.OrgId,
		NamespaceUID:    namespaceUID,
		RuleGroupConfig: rgc,
	}

	if !save {
		return response.JSON(200, cmd)
	}

	// note: Update rule group will set the Interval within the grafana_alert from
	// the interval of the group.
	err = api.RuleStore.UpdateRuleGroup(cmd)

	if err != nil {
		return response.JSON(400, util.DynMap{
			"message:": "failed to save alert rule",
			"error":    err.Error(),
			"cmd":      cmd,
		})
	}

	return response.JSON(200, cmd)
}

func transNoData(s string) (ngmodels.NoDataState, error) {
	switch s {
	case "ok":
		return ngmodels.OK, nil
	case "no_data":
		return ngmodels.NoData, nil
	case "alerting":
		return ngmodels.Alerting, nil
	case "keep_state":
		return ngmodels.KeepLastState, nil
	}
	return ngmodels.NoData, fmt.Errorf("unrecognized No Data setting %v", s)
}

func transExecErr(s string) (ngmodels.ExecutionErrorState, error) {
	switch s {
	case "alerting":
		return ngmodels.AlertingErrState, nil
	case "KeepLastState":
		return ngmodels.KeepLastStateErrState, nil
	}
	return ngmodels.AlertingErrState, fmt.Errorf("unrecognized Execution Error setting %v", s)
}

func adjustInterval(freq int64) model.Duration {
	// 10 corresponds to the SchedulerCfg, but TODO not worrying about fetching for now.
	var baseFreq int64 = 10
	if freq <= baseFreq {
		return model.Duration(time.Second * 10)
	}
	return model.Duration(time.Duration((freq - (freq % baseFreq))) * time.Second)
}
