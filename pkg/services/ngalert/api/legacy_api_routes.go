package api

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/expr/translate"

	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/common/model"
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

	return response.JSONStreaming(200, util.DynMap{
		"instances": []*data.Frame{&frame},
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

	// TODO: Need place to put FOR duration

	rule := ngmodels.AlertRule{
		Title:        oldAlert.Name,
		Data:         sseCond.Data,
		Condition:    sseCond.Condition,
		NoDataState:  *noDataSetting,
		ExecErrState: *execErrSetting,
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
