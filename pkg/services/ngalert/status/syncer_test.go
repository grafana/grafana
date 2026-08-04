package status

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type fakeOrgs struct{ orgs []int64 }

func (f *fakeOrgs) FetchOrgIds(context.Context) ([]int64, error) { return f.orgs, nil }

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

// fakeRuleClient is an in-memory resource.Client: List returns a preseeded list
// and Update (the /status write) captures the object per name. Only those two
// paths are exercised; the rest are inert stubs.
type fakeRuleClient struct {
	list    resource.ListObject
	updated map[string]resource.Object
	updates int
}

func newFakeRuleClient(list resource.ListObject) *fakeRuleClient {
	return &fakeRuleClient{list: list, updated: map[string]resource.Object{}}
}

func (f *fakeRuleClient) List(context.Context, string, resource.ListOptions) (resource.ListObject, error) {
	return f.list, nil
}

func (f *fakeRuleClient) Update(_ context.Context, id resource.Identifier, obj resource.Object, _ resource.UpdateOptions) (resource.Object, error) {
	f.updated[id.Name] = obj
	f.updates++
	return obj, nil
}

func (f *fakeRuleClient) Get(context.Context, resource.Identifier) (resource.Object, error) {
	return nil, nil
}
func (f *fakeRuleClient) GetInto(context.Context, resource.Identifier, resource.Object) error {
	return nil
}
func (f *fakeRuleClient) Create(context.Context, resource.Identifier, resource.Object, resource.CreateOptions) (resource.Object, error) {
	return nil, nil
}
func (f *fakeRuleClient) CreateInto(context.Context, resource.Identifier, resource.Object, resource.CreateOptions, resource.Object) error {
	return nil
}
func (f *fakeRuleClient) UpdateInto(context.Context, resource.Identifier, resource.Object, resource.UpdateOptions, resource.Object) error {
	return nil
}
func (f *fakeRuleClient) Patch(context.Context, resource.Identifier, resource.PatchRequest, resource.PatchOptions) (resource.Object, error) {
	return nil, nil
}
func (f *fakeRuleClient) PatchInto(context.Context, resource.Identifier, resource.PatchRequest, resource.PatchOptions, resource.Object) error {
	return nil
}
func (f *fakeRuleClient) Delete(context.Context, resource.Identifier, resource.DeleteOptions) error {
	return nil
}
func (f *fakeRuleClient) ListInto(context.Context, string, resource.ListOptions, resource.ListObject) error {
	return nil
}
func (f *fakeRuleClient) Watch(context.Context, string, resource.WatchOptions) (resource.WatchResponse, error) {
	return nil, nil
}
func (f *fakeRuleClient) SubresourceRequest(context.Context, resource.Identifier, resource.CustomRouteRequestOptions) ([]byte, error) {
	return nil, nil
}

// fakeGenerator returns the alert or recording fake based on the requested kind,
// since resource.Client.List carries no kind to distinguish them.
type fakeGenerator struct{ alert, recording *fakeRuleClient }

func (g *fakeGenerator) ClientFor(k resource.Kind) (resource.Client, error) {
	if k.Kind() == model.RecordingRuleKind().Kind() {
		return g.recording, nil
	}
	return g.alert, nil
}
func (g *fakeGenerator) GetCustomRouteClient(schema.GroupVersion, string) (resource.CustomRouteClient, error) {
	return nil, nil
}
func (g *fakeGenerator) DiscoveryClient() (resource.DiscoveryClient, error) { return nil, nil }

func alertRuleObj(uid string) model.AlertRule {
	r := model.AlertRule{}
	r.Name = uid
	r.Namespace = "default"
	return r
}

func recordingRuleObj(uid string) model.RecordingRule {
	r := model.RecordingRule{}
	r.Name = uid
	r.Namespace = "default"
	return r
}

func newTestSyncer(t *testing.T, gen *fakeGenerator, states *fakeStates, status *fakeStatus) *Syncer {
	t.Helper()
	s, err := NewSyncer(
		&fakeOrgs{orgs: []int64{1}},
		states,
		status,
		func(int64) string { return "default" },
		time.Minute,
		log.NewNopLogger(),
		gen,
	)
	require.NoError(t, err)
	return s
}

func TestSyncer_sync_writesBothKindsAndDedupes(t *testing.T) {
	gen := &fakeGenerator{
		alert:     newFakeRuleClient(&model.AlertRuleList{Items: []model.AlertRule{alertRuleObj("alert1")}}),
		recording: newFakeRuleClient(&model.RecordingRuleList{Items: []model.RecordingRule{recordingRuleObj("rec1")}}),
	}
	states := &fakeStates{byUID: map[string][]*state.State{
		"alert1": {{State: eval.Alerting, LastEvaluationTime: time.Now()}},
	}}
	status := &fakeStatus{byUID: map[string]ngmodels.RuleStatus{
		"rec1": {Health: "ok", EvaluationTimestamp: time.Now()},
	}}
	s := newTestSyncer(t, gen, states, status)

	require.NoError(t, s.sync(context.Background()))
	require.Equal(t, 1, gen.alert.updates)
	require.Equal(t, 1, gen.recording.updates)

	ar := gen.alert.updated["alert1"].(*model.AlertRule)
	require.Equal(t, model.AlertRuleAlertRuleStateFiring, *ar.Status.State)
	rr := gen.recording.updated["rec1"].(*model.RecordingRule)
	require.Equal(t, model.RecordingRuleRecordingRuleHealthRecording, *rr.Status.Health)

	// A second sync with unchanged status writes nothing new.
	require.NoError(t, s.sync(context.Background()))
	require.Equal(t, 1, gen.alert.updates)
	require.Equal(t, 1, gen.recording.updates)
}

func TestSyncer_sync_rewritesWhenStatusChanges(t *testing.T) {
	gen := &fakeGenerator{
		alert:     newFakeRuleClient(&model.AlertRuleList{Items: []model.AlertRule{alertRuleObj("alert1")}}),
		recording: newFakeRuleClient(&model.RecordingRuleList{}),
	}
	states := &fakeStates{byUID: map[string][]*state.State{"alert1": {{State: eval.Normal}}}}
	s := newTestSyncer(t, gen, states, &fakeStatus{})

	require.NoError(t, s.sync(context.Background()))
	require.Equal(t, 1, gen.alert.updates)

	states.byUID["alert1"] = []*state.State{{State: eval.Alerting}}
	require.NoError(t, s.sync(context.Background()))
	require.Equal(t, 2, gen.alert.updates)
}
