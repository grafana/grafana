package api

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type fakeAlertInstanceManager struct {
	mtx sync.Mutex
	// orgID -> RuleID -> States
	states map[int64]map[string][]*state.State
}

func NewFakeAlertInstanceManager(t *testing.T) *fakeAlertInstanceManager {
	t.Helper()

	return &fakeAlertInstanceManager{
		states: map[int64]map[string][]*state.State{},
	}
}

func (f *fakeAlertInstanceManager) GetAll(orgID int64) []*state.State {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	var s []*state.State

	for orgID := range f.states {
		for _, states := range f.states[orgID] {
			s = append(s, states...)
		}
	}

	return s
}

func (f *fakeAlertInstanceManager) GetStatesForRuleUID(orgID int64, alertRuleUID string) []*state.State {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	return f.states[orgID][alertRuleUID]
}

// forEachState represents the callback used when generating alert instances that allows us to modify the generated result
type forEachState func(s *state.State) *state.State

func (f *fakeAlertInstanceManager) GenerateAlertInstances(orgID int64, alertRuleUID string, count int, callbacks ...forEachState) {
	f.mtx.Lock()
	defer f.mtx.Unlock()

	evaluationTime := timeNow()
	evaluationDuration := 1 * time.Minute

	for i := 0; i < count; i++ {
		_, ok := f.states[orgID]
		if !ok {
			f.states[orgID] = map[string][]*state.State{}
		}
		_, ok = f.states[orgID][alertRuleUID]
		if !ok {
			f.states[orgID][alertRuleUID] = []*state.State{}
		}

		newState := &state.State{
			AlertRuleUID: alertRuleUID,
			OrgID:        1,
			Labels: data.Labels{
				"__alert_rule_namespace_uid__": "test_namespace_uid",
				"__alert_rule_uid__":           fmt.Sprintf("test_alert_rule_uid_%v", i),
				"alertname":                    fmt.Sprintf("test_title_%v", i),
				"label":                        "test",
				"instance_label":               "test",
			},
			State: eval.Normal,
			Results: []state.Evaluation{
				{
					EvaluationTime:  evaluationTime,
					EvaluationState: eval.Normal,
					Values:          make(map[string]*float64),
				},
				{
					EvaluationTime:  evaluationTime.Add(1 * time.Minute),
					EvaluationState: eval.Normal,
					Values:          make(map[string]*float64),
				},
			},
			LastEvaluationTime: evaluationTime.Add(1 * time.Minute),
			EvaluationDuration: evaluationDuration,
			Annotations:        map[string]string{"annotation": "test"},
		}

		if len(callbacks) != 0 {
			for _, cb := range callbacks {
				newState = cb(newState)
			}
		}

		f.states[orgID][alertRuleUID] = append(f.states[orgID][alertRuleUID], newState)
	}
}
