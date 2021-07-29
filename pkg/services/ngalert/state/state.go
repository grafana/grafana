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
	State              eval.State
	Resolved           bool
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
	// Values contains the RefID and value of reduce and math expressions.
	// It does not contain values for classic conditions as the values
	// in classic conditions do not have a RefID.
	Values map[string]EvaluationValue
}

// EvaluationValue contains the labels and value for a RefID in an evaluation.
type EvaluationValue struct {
	Labels data.Labels
	Value  *float64
}

// NewEvaluationValues returns the labels and values for each RefID in the capture.
func NewEvaluationValues(m map[string]eval.NumberValueCapture) map[string]EvaluationValue {
	result := make(map[string]EvaluationValue, len(m))
	for k, v := range m {
		result[k] = EvaluationValue{
			Labels: v.Labels,
			Value:  v.Value,
		}
	}
	return result
}

func (a *State) resultNormal(alertRule *ngModels.AlertRule, result eval.Result) {
	if a.State != eval.Normal {
		a.EndsAt = result.EvaluatedAt
		a.StartsAt = result.EvaluatedAt
	}
	a.Error = result.Error // should be nil since state is not error
	a.State = eval.Normal
}

func (a *State) resultAlerting(alertRule *ngModels.AlertRule, result eval.Result) {
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
}

func (a *State) resultError(alertRule *ngModels.AlertRule, result eval.Result) {
	a.Error = result.Error
	if a.StartsAt.IsZero() {
		a.StartsAt = result.EvaluatedAt
	}
	a.setEndsAt(alertRule, result)

	if alertRule.ExecErrState == ngModels.AlertingErrState {
		a.State = eval.Alerting
	}
}

func (a *State) resultNoData(alertRule *ngModels.AlertRule, result eval.Result) {
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
}

func (a *State) NeedsSending(resendDelay time.Duration) bool {
	if a.State != eval.Alerting && a.State != eval.Normal {
		return false
	}

	if a.State == eval.Normal && !a.Resolved {
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
