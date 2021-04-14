package api

import (
	"fmt"
	"time"

	"github.com/prometheus/common/model"

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

	if err := validateCondition(*evalCond, c.SignedInUser, c.SkipCache, api.DatasourceCache); err != nil {
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

	if err := validateCondition(*evalCond, c.SignedInUser, c.SkipCache, api.DatasourceCache); err != nil {
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
	// Get dashboard alert definition from database.
	oldAlert, status, err := transGetAlertById(id, *c.SignedInUser)
	if err != nil {
		return response.Error(status, "failed to get alert", fmt.Errorf("failed to get alert for alert id %v: %w", id, err))
	}
	// Translate the dashboard's alerts conditions into SSE queries and conditions.
	sseCond, err := transToSSECondition(oldAlert, *c.SignedInUser)
	if err != nil {
		return response.Error(400, "failed to translate alert conditions",
			fmt.Errorf("failed to translate alert conditions for alert id %v: %w", id, err))
	}
	// Get the dashboard that contains the dashboard Alert.
	oldAlertsDash, status, err := transGetAlertsDashById(oldAlert.DashboardId, *c.SignedInUser)
	if err != nil {
		return response.Error(status, "failed to get alert's dashboard", fmt.Errorf("failed to get dashboard for alert id %v, %w", id, err))
	}
	isGeneralFolder := oldAlertsDash.FolderId == 0 && !oldAlertsDash.IsFolder
	var namespaceUID string
	if isGeneralFolder {
		namespaceUID = "General"
	} else {
		// Get the folder that contains the dashboard that contains the dashboard alert.
		getFolder := &models.GetDashboardQuery{
			Id:    oldAlertsDash.FolderId,
			OrgId: oldAlertsDash.OrgId,
		}
		if err := bus.Dispatch(getFolder); err != nil {
			return response.Error(400, fmt.Sprintf("could find folder %v for alert with id %v", getFolder.Id, id), err)
		}
		namespaceUID = getFolder.Result.Uid
	}
	noDataSetting, execErrSetting, err := transNoDataExecSettings(oldAlert, *c.SignedInUser)
	if err != nil {
		return response.Error(400, "unable to translate nodata/exec error settings",
			fmt.Errorf("unable to translate nodata/exec error settings for alert id %v: %w", id, err))
	}

	ruleTags := map[string]string{}

	for k, v := range oldAlert.Settings.Get("alertRuleTags").MustMap() {
		sV, ok := v.(string)
		if !ok {
			return response.Error(400, "unable to unmarshal rule tags",
				fmt.Errorf("unexpected type %T for tag %v", v, k))
		}
		ruleTags[k] = sV
	}

	rule := ngmodels.AlertRule{
		Title:        oldAlert.Name,
		Data:         sseCond.Data,
		Condition:    sseCond.Condition,
		NoDataState:  *noDataSetting,
		ExecErrState: *execErrSetting,
		For:          ngmodels.Duration(oldAlert.For),
		Annotations:  ruleTags,
	}
	rgc := apimodels.PostableRuleGroupConfig{
		// TODO? Generate new name on conflict?
		Name:     oldAlert.Name,
		Interval: transAdjustInterval(oldAlert.Frequency),
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

func transAdjustInterval(freq int64) model.Duration {
	// 10 corresponds to the SchedulerCfg, but TODO not worrying about fetching for now.
	var baseFreq int64 = 10
	if freq <= baseFreq {
		return model.Duration(time.Second * 10)
	}
	return model.Duration(time.Duration((freq - (freq % baseFreq))) * time.Second)
}

func transGetAlertById(id int64, user models.SignedInUser) (*models.Alert, int, error) {
	getAlert := &models.GetAlertByIdQuery{
		Id: id,
	}
	if err := bus.Dispatch(getAlert); err != nil {
		return nil, 400, fmt.Errorf("could find alert with id %v: %w", id, err)
	}
	if getAlert.Result.OrgId != user.OrgId {
		return nil, 403, fmt.Errorf("alert does not match organization of user")
	}
	return getAlert.Result, 0, nil
}

func transGetAlertsDashById(dashboardId int64, user models.SignedInUser) (*models.Dashboard, int, error) {
	getDash := &models.GetDashboardQuery{
		Id:    dashboardId,
		OrgId: user.OrgId,
	}
	if err := bus.Dispatch(getDash); err != nil {
		return nil, 400, fmt.Errorf("could find dashboard with id %v: %w", dashboardId, err)
	}
	return getDash.Result, 0, nil
}

func transToSSECondition(m *models.Alert, user models.SignedInUser) (*ngmodels.Condition, error) {
	sb, err := m.Settings.ToDB()
	if err != nil {
		return nil, fmt.Errorf("failed to marshal alert settings: %w", err)
	}
	evalCond, err := translate.DashboardAlertConditions(sb, user.OrgId)
	if err != nil {
		return nil, fmt.Errorf("failed to translate dashboard alert to SSE conditions: %w", err)
	}
	return evalCond, nil
}

func transNoDataExecSettings(m *models.Alert, user models.SignedInUser) (*ngmodels.NoDataState, *ngmodels.ExecutionErrorState, error) {
	oldNoData := m.Settings.Get("noDataState").MustString()
	noDataSetting, err := transNoData(oldNoData)
	if err != nil {
		return nil, nil, err
	}
	oldExecErr := m.Settings.Get("executionErrorState").MustString()
	execErrSetting, err := transExecErr(oldExecErr)
	if err != nil {
		return nil, nil, err
	}
	return &noDataSetting, &execErrSetting, nil
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
