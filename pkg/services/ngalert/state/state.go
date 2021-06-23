package state

import (
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type State struct {
	AlertRuleUID       string
	OrgID              int64
	CacheId            string
	State              eval.State
	Results            []Evaluation
	StartsAt           time.Time
	EndsAt             time.Time
	LastEvaluationTime time.Time
	EvaluationDuration time.Duration
	LastSentAt         time.Time
	Annotations        map[string]string
	Labels             data.Labels
	Error              error
}

type Evaluation struct {
	EvaluationTime   time.Time
	EvaluationState  eval.State
	EvaluationString string
}

func (a *State) resultNormal(alertRule *ngModels.AlertRule, result eval.Result) {
	oldState := a.State
	if a.State != eval.Normal {
		a.EndsAt = result.EvaluatedAt
		a.StartsAt = result.EvaluatedAt
	}
	a.Error = result.Error // should be nil since state is not error
	a.State = eval.Normal
	if oldState != a.State {
		createAlertAnnotation(oldState, a.State, alertRule, result)
	}
}

func (a *State) resultAlerting(alertRule *ngModels.AlertRule, result eval.Result) {
	oldState := a.State
	switch a.State {
	case eval.Alerting:
		a.setEndsAt(alertRule, result)
	case eval.Pending:
		if result.EvaluatedAt.Sub(a.StartsAt) > alertRule.For {
			a.State = eval.Alerting
			a.StartsAt = result.EvaluatedAt
			a.setEndsAt(alertRule, result)
		}
	default:
		a.StartsAt = result.EvaluatedAt
		a.setEndsAt(alertRule, result)
		if !(alertRule.For > 0) {
			// If For is 0, immediately set Alerting
			a.State = eval.Alerting
		} else {
			a.State = eval.Pending
		}
	}
	if oldState != a.State {
		createAlertAnnotation(oldState, a.State, alertRule, result)
	}
}

func (a *State) resultError(alertRule *ngModels.AlertRule, result eval.Result) {
	oldState := a.State
	a.Error = result.Error
	if a.StartsAt.IsZero() {
		a.StartsAt = result.EvaluatedAt
	}
	a.setEndsAt(alertRule, result)

	if alertRule.ExecErrState == ngModels.AlertingErrState {
		a.State = eval.Alerting
	}
	if oldState != a.State {
		createAlertAnnotation(oldState, a.State, alertRule, result)
	}
}

func (a *State) resultNoData(alertRule *ngModels.AlertRule, result eval.Result) {
	oldState := a.State
	if a.StartsAt.IsZero() {
		a.StartsAt = result.EvaluatedAt
	}
	a.setEndsAt(alertRule, result)

	switch alertRule.NoDataState {
	case ngModels.Alerting:
		a.State = eval.Alerting
	case ngModels.NoData:
		a.State = eval.NoData
	case ngModels.OK:
		a.State = eval.Normal
	}
	if oldState != a.State {
		createAlertAnnotation(oldState, a.State, alertRule, result)
	}
}

func (a *State) NeedsSending(resendDelay time.Duration) bool {
	if a.State != eval.Alerting {
		return false
	}

	// if LastSentAt is before or equal to LastEvaluationTime + resendDelay, send again
	return a.LastSentAt.Add(resendDelay).Before(a.LastEvaluationTime) ||
		a.LastSentAt.Add(resendDelay).Equal(a.LastEvaluationTime)
}

func (a *State) Equals(b *State) bool {
	return a.AlertRuleUID == b.AlertRuleUID &&
		a.OrgID == b.OrgID &&
		a.CacheId == b.CacheId &&
		a.Labels.String() == b.Labels.String() &&
		a.State.String() == b.State.String() &&
		a.StartsAt == b.StartsAt &&
		a.EndsAt == b.EndsAt &&
		a.LastEvaluationTime == b.LastEvaluationTime &&
		data.Labels(a.Annotations).String() == data.Labels(b.Annotations).String()
}

func (a *State) TrimResults(alertRule *ngModels.AlertRule) {
	numBuckets := 2 * (int64(alertRule.For.Seconds()) / alertRule.IntervalSeconds)
	if numBuckets == 0 {
		numBuckets = 10 // keep at least 10 evaluations in the event For is set to 0
	}

	if len(a.Results) < int(numBuckets) {
		return
	}
	newResults := make([]Evaluation, numBuckets)
	copy(newResults, a.Results[len(a.Results)-int(numBuckets):])
	a.Results = newResults
}

func (a *State) setEndsAt(alertRule *ngModels.AlertRule, result eval.Result) {
	if int64(alertRule.For.Seconds()) > alertRule.IntervalSeconds {
		// For is set and longer than IntervalSeconds
		a.EndsAt = result.EvaluatedAt.Add(alertRule.For)
	} else {
		// For is not set or is less than or equal to IntervalSeconds
		a.EndsAt = result.EvaluatedAt.Add(time.Duration(alertRule.IntervalSeconds*2) * time.Second)
	}
}

func createAlertAnnotation(old, new eval.State, alertRule *ngModels.AlertRule, result eval.Result) {
	dashUid, ok := alertRule.Annotations["__dashboardUid__"]
	if !ok {
		return
	}

	annotationData := simplejson.New()
	if len(result.EvaluationString) > 0 {
		fmt.Println(result.EvaluationString)
		annotationData.Set("evalMatches", simplejson.NewFromAny(result.EvaluationString))
	}
	if result.Error != nil {
		annotationData.Set("error", result.Error.Error())
	}

	panelUid, _ := alertRule.Annotations["__panelId__"]

	fmt.Printf("*******************\nDashboardUID: %s PanelUID: %s\n*******************\n", dashUid, panelUid)
	panelId, err := strconv.ParseInt(panelUid, 10, 64)
	if err != nil {
		fmt.Println("********* " + err.Error())
		return // TODO: return error and log
	}

	query := &models.GetDashboardQuery{
		Uid:   dashUid,
		OrgId: alertRule.OrgID,
	}

	err = sqlstore.GetDashboard(query)
	if err != nil {
		fmt.Println("+++++++++++ " + err.Error())
		return // TODO: return error and log
	}

	item := &annotations.Item{
		OrgId:       alertRule.OrgID,
		DashboardId: query.Result.Id,
		PanelId:     panelId,
		Text:        "SomeThing",
		NewState:    "alerting",
		PrevState:   "normal",
		Epoch:       result.EvaluatedAt.UnixNano() / int64(time.Millisecond),
		Data:        annotationData,
	}

	annotationRepo := annotations.GetRepository()
	if err = annotationRepo.Save(item); err != nil {
		fmt.Println("!!!!!!!!!!!! " + err.Error())
		return // TODO: return error and log
	}

	fmt.Printf("%+v\n", item)
	fmt.Println("_______")
	fmt.Println(*annotationData)
}
