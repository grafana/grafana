package evaltest

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/ngalert/models/modelstest"
)

type ResultMutator func(r *eval.Result)

func RandomState() eval.State {
	return []eval.State{
		eval.Normal,
		eval.Alerting,
		eval.NoData,
		eval.Error,
	}[rand.Intn(4)]
}

func GenerateResults(count int, generator func() eval.Result) eval.Results {
	var result = make(eval.Results, 0, count)
	for range count {
		result = append(result, generator())
	}
	return result
}

func ResultGen(mutators ...ResultMutator) func() eval.Result {
	return func() eval.Result {
		state := RandomState()
		var err error
		if state == eval.Error {
			err = fmt.Errorf("result_error")
		}
		result := eval.Result{
			Instance:           modelstest.GenerateAlertLabels(rand.Intn(5)+1, "result_"),
			State:              state,
			Error:              err,
			EvaluatedAt:        time.Time{},
			EvaluationDuration: time.Duration(rand.Int63n(6)) * time.Second,
			EvaluationString:   "",
			Values:             nil,
		}
		for _, mutator := range mutators {
			mutator(&result)
		}
		return result
	}
}

func WithEvaluatedAt(time time.Time) ResultMutator {
	return func(r *eval.Result) {
		r.EvaluatedAt = time
	}
}

func WithState(state eval.State) ResultMutator {
	return func(r *eval.Result) {
		r.State = state
		if state == eval.Error {
			r.Error = fmt.Errorf("with_state_error")
		}
	}
}

func WithError(err error) ResultMutator {
	return func(r *eval.Result) {
		r.State = eval.Error
		r.Error = err
	}
}

func WithLabels(labels data.Labels) ResultMutator {
	return func(r *eval.Result) {
		r.Instance = labels
	}
}

func WithValues(values map[string]eval.NumberValueCapture) ResultMutator {
	return func(r *eval.Result) {
		r.Values = values
	}
}
