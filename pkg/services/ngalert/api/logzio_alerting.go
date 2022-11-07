package api

// LOGZ.IO GRAFANA CHANGE :: DEV-30169,DEV-30170: add endpoints to evaluate and process alerts
import (
	"context"
	"errors"
	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrations/ualert"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"math"
	"net/http"
	"net/url"
)

const (
	EvaluationErrorRefIdKey = "REF_ID"
	QueryErrorType          = "QUERY_ERROR"
	OtherErrorType          = "OTHER"
)

type LogzioAlertingService struct {
	AlertingProxy        *AlertingProxy
	Cfg                  *setting.Cfg
	AppUrl               *url.URL
	Evaluator            eval.Evaluator
	Clock                clock.Clock
	ExpressionService    *expr.Service
	StateManager         *state.Manager
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager
	InstanceStore        store.InstanceStore
	Log                  log.Logger
	Migrator             *migrator.Migrator
}

func NewLogzioAlertingService(
	Proxy *AlertingProxy,
	Cfg *setting.Cfg,
	Evaluator eval.Evaluator,
	Clock clock.Clock,
	ExpressionService *expr.Service,
	StateManager *state.Manager,
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager,
	InstanceStore store.InstanceStore,
	log log.Logger,
	SQLStore *sqlstore.SQLStore,
) *LogzioAlertingService {
	return &LogzioAlertingService{
		AlertingProxy:        Proxy,
		Cfg:                  Cfg,
		AppUrl:               Cfg.ParsedAppURL,
		Clock:                Clock,
		Evaluator:            Evaluator,
		ExpressionService:    ExpressionService,
		StateManager:         StateManager,
		MultiOrgAlertmanager: MultiOrgAlertmanager,
		InstanceStore:        InstanceStore,
		Log:                  log,
		Migrator:             SQLStore.BuildMigrator(),
	}
}

func (srv *LogzioAlertingService) RouteEvaluateAlert(httpReq http.Request, evalRequest apimodels.AlertEvaluationRequest) response.Response {
	alertRuleToEvaluate := apiRuleToDbAlertRule(evalRequest.AlertRule)
	condition := ngmodels.Condition{
		Condition: alertRuleToEvaluate.Condition,
		OrgID:     alertRuleToEvaluate.OrgID,
		Data:      alertRuleToEvaluate.Data,
	}

	var dsOverrideByDsUid = map[string]ngmodels.EvaluationDatasourceOverride{}
	if evalRequest.DsOverrides != nil {
		for _, dsOverride := range evalRequest.DsOverrides {
			dsOverrideByDsUid[dsOverride.DsUid] = dsOverride
		}
	}

	start := srv.Clock.Now()
	evalResults, err := srv.Evaluator.ConditionEval(&condition, evalRequest.EvalTime, srv.ExpressionService, &ngmodels.LogzioAlertRuleEvalContext{
		LogzioHeaders:     httpReq.Header,
		DsOverrideByDsUid: dsOverrideByDsUid,
	})
	dur := srv.Clock.Now().Sub(start)

	if err != nil {
		srv.Log.Error("failed to evaluate alert rule", "duration", dur, "err", err, "ruleId", alertRuleToEvaluate.ID)
		return response.Error(http.StatusInternalServerError, "Failed to evaluate conditions", err)
	}

	var apiEvalResults []apimodels.ApiEvalResult
	for _, result := range evalResults {
		apiEvalResults = append(apiEvalResults, evaluationResultsToApi(result))
	}

	return response.JSON(http.StatusOK, apiEvalResults)
}

func (srv *LogzioAlertingService) RouteProcessAlert(httpReq http.Request, request apimodels.AlertProcessRequest) response.Response {
	alertRule := apiRuleToDbAlertRule(request.AlertRule)

	var shouldCreateAnnotationsAndAlertInstances bool
	if request.ShouldManageAnnotationsAndInstances == nil {
		shouldCreateAnnotationsAndAlertInstances = true
	} else {
		shouldCreateAnnotationsAndAlertInstances = *request.ShouldManageAnnotationsAndInstances
	}

	var evalResults eval.Results
	for _, apiEvalResult := range request.EvaluationResults {
		evalResults = append(evalResults, apiToEvaluationResult(apiEvalResult))
	}

	ctx := context.WithValue(httpReq.Context(), state.ShouldManageAnnotationsAndInstancesContextKey, shouldCreateAnnotationsAndAlertInstances)

	processedStates := srv.StateManager.ProcessEvalResults(ctx, &alertRule, evalResults)
	if shouldCreateAnnotationsAndAlertInstances {
		srv.saveAlertStates(processedStates)
	}
	alerts := schedule.FromAlertStateToPostableAlerts(processedStates, srv.StateManager, srv.AppUrl)

	if len(alerts.PostableAlerts) > 0 {
		n, err := srv.MultiOrgAlertmanager.AlertmanagerFor(alertRule.OrgID)
		if err == nil {
			srv.Log.Info("Pushing alerts to alert manager")
			if err := n.PutAlerts(alerts); err != nil {
				srv.Log.Error("failed to put alerts in the local notifier", "count", len(alerts.PostableAlerts), "err", err, "ruleId", alertRule.ID)
				return response.Error(http.StatusInternalServerError, "Failed to process alert", err)
			}
		} else {
			if errors.Is(err, notifier.ErrNoAlertmanagerForOrg) {
				srv.Log.Info("local notifier was not found", "orgId", alertRule.OrgID)
				return response.Error(http.StatusBadRequest, "Alert manager for organization not found", err)
			} else {
				srv.Log.Error("local notifier is not available", "err", err, "orgId", alertRule.OrgID)
				return response.Error(http.StatusInternalServerError, "Failed to process alert", err)
			}
		}
	} else {
		srv.Log.Debug("no alerts to put in the notifier or to send to external Alertmanager(s)")
	}

	return response.JSONStreaming(http.StatusOK, alerts)
}

func (srv *LogzioAlertingService) RouteMigrateOrg(request RunAlertMigrationForOrg) response.Response {
	channelUidByEmailAddress := make(map[string]string)
	for _, emailNot := range request.EmailNotifications {
		channelUidByEmailAddress[emailNot.EmailAddress] = emailNot.ChannelUid
	}
	alertMigration := ualert.NewOrgAlertMigration(request.OrgId, channelUidByEmailAddress)

	if err := srv.Migrator.RunMigration(alertMigration); err != nil {
		srv.Log.Error("Failed to run alert migration", "orgId", request.OrgId, "err", err)
		return response.Error(http.StatusInternalServerError, "Failed to run alert migration", err)
	}

	if err := srv.Migrator.RunMigration(&ualert.UpdateOrgDashboardUIDPanelIDMigration{OrgId: request.OrgId}); err != nil {
		srv.Log.Error("Failed to run update dashboard uuid and panel ID migration", "orgId", request.OrgId, "err", err)
		return response.Error(http.StatusInternalServerError, "Failed to run update dashboard uuid and panel ID migration", err)
	}

	return response.JSONStreaming(http.StatusOK, "Success")
}

func (srv *LogzioAlertingService) RouteClearOrgMigration(requestBody ClearOrgAlertMigration) response.Response {
	migration := &ualert.RmOrgAlertMigration{OrgId: requestBody.OrgId}

	if err := srv.Migrator.RunMigration(migration); err != nil {
		srv.Log.Error("Failed to run clear alert migration", "orgId", requestBody.OrgId, "err", err)
		return response.Error(http.StatusInternalServerError, "Failed to run clear alert migration", err)
	}

	return response.JSONStreaming(http.StatusOK, "Success")
}

func evaluationResultsToApi(evalResult eval.Result) apimodels.ApiEvalResult {
	apiEvalResult := apimodels.ApiEvalResult{
		Instance:           evalResult.Instance,
		State:              evalResult.State,
		StateName:          evalResult.State.String(),
		EvaluatedAt:        evalResult.EvaluatedAt,
		EvaluationDuration: evalResult.EvaluationDuration,
		EvaluationString:   evalResult.EvaluationString,
	}

	if evalResult.Values != nil {
		apiEvalResult.Values = make(map[string]apimodels.ApiNumberValueCapture, len(evalResult.Values))
		for k, v := range evalResult.Values {
			apiEvalResult.Values[k] = valueNumberCaptureToApi(v)
		}
	}

	if evalResult.Error != nil {
		errorMetadata := make(map[string]string)

		var queryError expr.QueryError
		if errors.As(evalResult.Error, &queryError) {
			apiEvalResult.Error = &apimodels.ApiEvalError{
				Type:    QueryErrorType,
				Message: queryError.Err.Error(),
			}

			errorMetadata[EvaluationErrorRefIdKey] = queryError.RefID
		} else {
			apiEvalResult.Error = &apimodels.ApiEvalError{
				Type:    OtherErrorType,
				Message: evalResult.Error.Error(),
			}
		}

		apiEvalResult.Error.Metadata = errorMetadata
	}

	return apiEvalResult
}

func apiToEvaluationResult(apiEvalResult apimodels.ApiEvalResult) eval.Result {
	evalResult := eval.Result{
		Instance:           apiEvalResult.Instance,
		State:              apiEvalResult.State,
		EvaluatedAt:        apiEvalResult.EvaluatedAt,
		EvaluationDuration: apiEvalResult.EvaluationDuration,
		EvaluationString:   apiEvalResult.EvaluationString,
	}

	if apiEvalResult.Values != nil {
		evalResult.Values = make(map[string]eval.NumberValueCapture, len(apiEvalResult.Values))

		for k, v := range apiEvalResult.Values {
			evalResult.Values[k] = apiToNumberValueCapture(v)
		}
	}

	if apiEvalResult.Error != nil {
		if apiEvalResult.Error.Type == QueryErrorType {
			errorMetadata := apiEvalResult.Error.Metadata
			refId := errorMetadata[EvaluationErrorRefIdKey]

			evalResult.Error = &expr.QueryError{
				RefID: refId,
				Err:   errors.New(apiEvalResult.Error.Message),
			}
		} else {
			evalResult.Error = errors.New(apiEvalResult.Error.Message)
		}
	}

	return evalResult
}

func apiRuleToDbAlertRule(api apimodels.ApiAlertRule) ngmodels.AlertRule {
	return ngmodels.AlertRule{
		ID:              api.ID,
		OrgID:           api.OrgID,
		Title:           api.Title,
		Condition:       api.Condition,
		Data:            api.Data,
		Updated:         api.Updated,
		IntervalSeconds: api.IntervalSeconds,
		Version:         api.Version,
		UID:             api.UID,
		NamespaceUID:    api.NamespaceUID,
		DashboardUID:    api.DashboardUID,
		PanelID:         api.PanelID,
		RuleGroup:       api.RuleGroup,
		NoDataState:     api.NoDataState,
		ExecErrState:    api.ExecErrState,
		For:             api.For,
		Annotations:     api.Annotations,
		Labels:          api.Labels,
	}
}

func apiToNumberValueCapture(api apimodels.ApiNumberValueCapture) eval.NumberValueCapture {
	var evalValue *float64

	if api.Value != nil {
		apiValue := *api.Value
		if api.IsNan {
			apiValue = math.NaN()
		}
		evalValue = &apiValue
	} else {
		evalValue = nil
	}

	return eval.NumberValueCapture{
		Var:    api.Var,
		Labels: api.Labels,
		Value:  evalValue,
	}
}

func valueNumberCaptureToApi(numberValueCapture eval.NumberValueCapture) apimodels.ApiNumberValueCapture {
	apiValue := numberValueCapture.Value
	isNan := false

	if numberValueCapture.Value != nil && math.IsNaN(*numberValueCapture.Value) {
		apiValue = nil
		isNan = true
	}

	return apimodels.ApiNumberValueCapture{
		Var:    numberValueCapture.Var,
		Labels: numberValueCapture.Labels,
		Value:  apiValue,
		IsNan:  isNan,
	}
}

func (srv *LogzioAlertingService) saveAlertStates(states []*state.State) {
	srv.Log.Debug("saving alert states", "count", len(states))
	instances := make([]ngmodels.AlertInstance, 0, len(states))

	type debugInfo struct {
		OrgID  int64
		Uid    string
		State  string
		Labels string
	}
	debug := make([]debugInfo, 0)

	for _, s := range states {
		labels := ngmodels.InstanceLabels(s.Labels)
		_, hash, err := labels.StringAndHash()

		if err != nil {
			debug = append(debug, debugInfo{s.OrgID, s.AlertRuleUID, s.State.String(), s.Labels.String()})
			srv.Log.Error("failed to save alert instance with invalid labels", "orgID", s.OrgID, "ruleUID", s.AlertRuleUID, "err", err)
			continue
		}
		fields := ngmodels.AlertInstance{
			AlertInstanceKey: ngmodels.AlertInstanceKey{
				RuleOrgID:  s.OrgID,
				RuleUID:    s.AlertRuleUID,
				LabelsHash: hash,
			},
			Labels:            ngmodels.InstanceLabels(s.Labels),
			CurrentState:      ngmodels.InstanceStateType(s.State.String()),
			LastEvalTime:      s.LastEvaluationTime,
			CurrentStateSince: s.StartsAt,
			CurrentStateEnd:   s.EndsAt,
		}
		instances = append(instances, fields)
	}

	if err := srv.InstanceStore.SaveAlertInstances(context.Background(), instances...); err != nil {
		for _, inst := range instances {
			debug = append(debug, debugInfo{inst.RuleOrgID, inst.RuleUID, string(inst.CurrentState), data.Labels(inst.Labels).String()})
		}
		srv.Log.Error("failed to save alert states", "states", debug, "err", err)
	}
}

// LOGZ.IO GRAFANA CHANGE :: end
