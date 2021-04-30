package state

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

type State struct {
	AlertRuleUID       string
	OrgID              int64
	CacheId            string
	Labels             data.Labels
	State              eval.State
	Results            []Evaluation
	StartsAt           time.Time
	EndsAt             time.Time
	LastEvaluationTime time.Time
	EvaluationDuration time.Duration
	Annotations        map[string]string
}

type Evaluation struct {
	EvaluationTime  time.Time
	EvaluationState eval.State
}

func resultNormal(alertState *State, result eval.Result) *State {
	newState := alertState
	if alertState.State != eval.Normal {
		newState.EndsAt = result.EvaluatedAt
	}
	newState.State = eval.Normal
	return newState
}

// addAnnotation adds an annotation to the state.
func (a *State) addAnnotation(key, value string) {
	if a.Annotations == nil {
		a.Annotations = make(map[string]string)
	}
	a.Annotations[key] = value
}

func (a *State) resultAlerting(alertRule *ngModels.AlertRule, result eval.Result) *State {
	switch a.State {
	case eval.Alerting:
		if !(alertRule.For > 0) {
			// If there is not For set, we will set EndsAt to be twice the evaluation interval
			// to avoid flapping with every evaluation
			a.EndsAt = result.EvaluatedAt.Add(time.Duration(alertRule.IntervalSeconds*2) * time.Second)
			return a
		}
		a.EndsAt = result.EvaluatedAt.Add(alertRule.For)
	case eval.Pending:
		if result.EvaluatedAt.Sub(a.StartsAt) > alertRule.For {
			a.State = eval.Alerting
			a.StartsAt = result.EvaluatedAt
			a.EndsAt = result.EvaluatedAt.Add(alertRule.For)
			a.addAnnotation("alerting_at", result.EvaluatedAt.String())
		}
	default:
		a.StartsAt = result.EvaluatedAt
		if !(alertRule.For > 0) {
			a.EndsAt = result.EvaluatedAt.Add(time.Duration(alertRule.IntervalSeconds*2) * time.Second)
			a.State = eval.Alerting
			a.addAnnotation("alerting_at", result.EvaluatedAt.String())
		} else {
			a.EndsAt = result.EvaluatedAt.Add(alertRule.For)
			if result.EvaluatedAt.Sub(a.StartsAt) > alertRule.For {
				a.State = eval.Alerting
				a.addAnnotation("alerting_at", result.EvaluatedAt.String())
			} else {
				a.State = eval.Pending
			}
		}
	}
	return a
}

func (a *State) resultError(alertRule *ngModels.AlertRule, result eval.Result) *State {
	if a.StartsAt.IsZero() {
		a.StartsAt = result.EvaluatedAt
	}
	if !(alertRule.For > 0) {
		a.EndsAt = result.EvaluatedAt.Add(time.Duration(alertRule.IntervalSeconds*2) * time.Second)
	} else {
		a.EndsAt = result.EvaluatedAt.Add(alertRule.For)
	}
	if a.State != eval.Error {
		a.addAnnotation("last_error", result.EvaluatedAt.String())
	}

	switch alertRule.ExecErrState {
	case ngModels.AlertingErrState:
		a.State = eval.Alerting
	case ngModels.KeepLastStateErrState:
	}
	return a
}

func (a *State) resultNoData(alertRule *ngModels.AlertRule, result eval.Result) *State {
	if a.StartsAt.IsZero() {
		a.StartsAt = result.EvaluatedAt
	}
	if !(alertRule.For > 0) {
		a.EndsAt = result.EvaluatedAt.Add(time.Duration(alertRule.IntervalSeconds*2) * time.Second)
	} else {
		a.EndsAt = result.EvaluatedAt.Add(alertRule.For)
	}
	if a.State != eval.NoData {
		a.addAnnotation("no_data", result.EvaluatedAt.String())
	}

	switch alertRule.NoDataState {
	case ngModels.Alerting:
		a.State = eval.Alerting
	case ngModels.NoData:
		a.State = eval.NoData
	case ngModels.KeepLastState:
	case ngModels.OK:
		a.State = eval.Normal
	}
	return a
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
