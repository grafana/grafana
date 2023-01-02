package eval

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type ResultMutator func(r *Result)

func RandomState() State {
	return []State{
		Normal,
		Alerting,
		NoData,
		Error,
	}[rand.Intn(4)]
}

func GenerateResults(count int, generator func() Result) Results {
	var result = make(Results, 0, count)
	for i := 0; i < count; i++ {
		result = append(result, generator())
	}
	return result
}

func ResultGen(mutators ...ResultMutator) func() Result {
	return func() Result {
		state := RandomState()
		var err error
		if state == Error {
			err = fmt.Errorf("result_error")
		}
		result := Result{
			Instance:           models.GenerateAlertLabels(rand.Intn(5)+1, "result_"),
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
	return func(r *Result) {
		r.EvaluatedAt = time
	}
}

func WithState(state State) ResultMutator {
	return func(r *Result) {
		r.State = state
		if state == Error {
			r.Error = fmt.Errorf("with_state_error")
		}
	}
}

func WithLabels(labels data.Labels) ResultMutator {
	return func(r *Result) {
		r.Instance = labels
	}
}
