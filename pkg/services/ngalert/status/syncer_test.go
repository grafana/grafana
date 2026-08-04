package status

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type fakeStore struct {
	orgs      []int64
	rules     map[int64]ngmodels.RulesGroup
	saved     map[string][]byte
	saveCount int
}

func newFakeStore() *fakeStore {
	return &fakeStore{rules: map[int64]ngmodels.RulesGroup{}, saved: map[string][]byte{}}
}

func (f *fakeStore) FetchOrgIds(_ context.Context) ([]int64, error) { return f.orgs, nil }

func (f *fakeStore) ListAlertRules(_ context.Context, q *ngmodels.ListAlertRulesQuery) (ngmodels.RulesGroup, error) {
	return f.rules[q.OrgID], nil
}

func (f *fakeStore) SaveAlertRuleStatus(_ context.Context, orgID int64, uid string, data []byte) error {
	f.saved[fmt.Sprintf("%d/%s", orgID, uid)] = data
	f.saveCount++
	return nil
}

type fakeStates struct{ byUID map[string][]*state.State }

func (f *fakeStates) GetStatesForRuleUID(_ context.Context, _ int64, uid string) []*state.State {
	return f.byUID[uid]
}

type fakeStatus struct {
	byUID map[string]ngmodels.RuleStatus
}

func (f *fakeStatus) Status(_ context.Context, key ngmodels.AlertRuleKey) (ngmodels.RuleStatus, bool) {
	rs, ok := f.byUID[key.UID]
	return rs, ok
}

func alertRule(uid string) *ngmodels.AlertRule { return &ngmodels.AlertRule{OrgID: 1, UID: uid} }
func recordingRule(uid string) *ngmodels.AlertRule {
	return &ngmodels.AlertRule{OrgID: 1, UID: uid, Record: &ngmodels.Record{}}
}

func TestSyncer_sync_writesBothKindsAndDedupes(t *testing.T) {
	store := newFakeStore()
	store.orgs = []int64{1}
	store.rules[1] = ngmodels.RulesGroup{alertRule("alert1"), recordingRule("rec1")}

	states := &fakeStates{byUID: map[string][]*state.State{
		"alert1": {{State: eval.Alerting, LastEvaluationTime: time.Now()}},
	}}
	status := &fakeStatus{byUID: map[string]ngmodels.RuleStatus{
		"rec1": {Health: "ok", EvaluationTimestamp: time.Now()},
	}}
	s := NewSyncer(store, states, status, time.Minute, log.NewNopLogger())

	require.NoError(t, s.sync(context.Background()))
	require.Equal(t, 2, store.saveCount)
	require.Contains(t, store.saved, "1/alert1")
	require.Contains(t, store.saved, "1/rec1")

	var as model.AlertRuleStatus
	require.NoError(t, json.Unmarshal(store.saved["1/alert1"], &as))
	require.Equal(t, model.AlertRuleAlertRuleStateFiring, *as.State)

	var rs model.RecordingRuleStatus
	require.NoError(t, json.Unmarshal(store.saved["1/rec1"], &rs))
	require.Equal(t, model.RecordingRuleRecordingRuleHealthRecording, *rs.Health)

	// A second sync with unchanged status writes nothing new.
	require.NoError(t, s.sync(context.Background()))
	require.Equal(t, 2, store.saveCount)
}

func TestSyncer_sync_rewritesWhenStatusChanges(t *testing.T) {
	store := newFakeStore()
	store.orgs = []int64{1}
	store.rules[1] = ngmodels.RulesGroup{alertRule("alert1")}
	states := &fakeStates{byUID: map[string][]*state.State{"alert1": {{State: eval.Normal}}}}
	s := NewSyncer(store, states, &fakeStatus{}, time.Minute, log.NewNopLogger())

	require.NoError(t, s.sync(context.Background()))
	require.Equal(t, 1, store.saveCount)

	states.byUID["alert1"] = []*state.State{{State: eval.Alerting}}
	require.NoError(t, s.sync(context.Background()))
	require.Equal(t, 2, store.saveCount)
}
