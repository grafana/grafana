package api

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/user"
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
			LatestResult: &state.Evaluation{
				EvaluationTime:  evaluationTime.Add(1 * time.Minute),
				EvaluationState: eval.Normal,
				Values:          make(map[string]float64),
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

type recordingAccessControlFake struct {
	ac.AccessControl
	Disabled           bool
	EvaluateRecordings []struct {
		User      *user.SignedInUser
		Evaluator ac.Evaluator
	}
	Callback func(user *user.SignedInUser, evaluator ac.Evaluator) (bool, error)
}

func (a *recordingAccessControlFake) Evaluate(ctx context.Context, ur identity.Requester, evaluator ac.Evaluator) (bool, error) {
	u := ur.(*user.SignedInUser)
	a.EvaluateRecordings = append(a.EvaluateRecordings, struct {
		User      *user.SignedInUser
		Evaluator ac.Evaluator
	}{User: u, Evaluator: evaluator})
	if a.Callback == nil {
		return false, nil
	}
	return a.Callback(u, evaluator)
}

var _ ac.AccessControl = &recordingAccessControlFake{}

type fakeRuleAccessControlService struct {
}

func (f fakeRuleAccessControlService) HasAccessToRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) (bool, error) {
	return true, nil
}

func (f fakeRuleAccessControlService) AuthorizeAccessToRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
	return nil
}

func (f fakeRuleAccessControlService) AuthorizeAccessInFolder(ctx context.Context, user identity.Requester, namespaced models.Namespaced) error {
	return nil
}

func (f fakeRuleAccessControlService) AuthorizeRuleChanges(ctx context.Context, user identity.Requester, change *store.GroupDelta) error {
	return nil
}

func (f fakeRuleAccessControlService) AuthorizeDatasourceAccessForRule(ctx context.Context, user identity.Requester, rule *models.AlertRule) error {
	return nil
}

func (f fakeRuleAccessControlService) AuthorizeDatasourceAccessForRuleGroup(ctx context.Context, user identity.Requester, rules models.RulesGroup) error {
	return nil
}

type statesReader interface {
	GetStatesForRuleUID(orgID int64, alertRuleUID string) []*state.State
}

type fakeSchedulerReader struct {
	states statesReader
}

func newFakeSchedulerReader(t *testing.T) *fakeSchedulerReader {
	return &fakeSchedulerReader{}
}

// setupStates allows the fake scheduler to return data consistent with states defined elsewhere.
// This can be combined with fakeAlertInstanceManager, for instance.
func (f *fakeSchedulerReader) setupStates(reader statesReader) *fakeSchedulerReader {
	f.states = reader
	return f
}

func (f *fakeSchedulerReader) Status(key models.AlertRuleKey) (models.RuleStatus, bool) {
	if f.states == nil {
		return models.RuleStatus{}, false
	}
	return state.StatesToRuleStatus(f.states.GetStatesForRuleUID(key.OrgID, key.UID)), true
}
