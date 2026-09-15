package schedule

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	alertingv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// fakeClientGenerator implements resource.ClientGenerator, returning a
// preconfigured error to simulate transient init failures.
type fakeClientGenerator struct {
	calls  int
	err    error
	client resource.Client
}

func (f *fakeClientGenerator) ClientFor(_ resource.Kind) (resource.Client, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	if f.client != nil {
		return f.client, nil
	}
	// Return nil client; NewRuleSequenceClient wraps it. The resulting
	// RuleSequenceClient cannot serve real requests, but that is fine for
	// testing the lazy-init retry logic (we only check that getClient
	// succeeds, not that the client can list).
	return nil, nil
}

func (f *fakeClientGenerator) GetCustomRouteClient(_ schema.GroupVersion, _ string) (resource.CustomRouteClient, error) {
	return nil, errors.New("not implemented")
}

func (f *fakeClientGenerator) DiscoveryClient() (resource.DiscoveryClient, error) {
	return nil, errors.New("not implemented")
}

// recordingClient records the namespace the store lists in. Only List is
// implemented; the embedded nil interface panics on any other call, so widening
// the store's use of the client surfaces here instead of passing silently.
type recordingClient struct {
	resource.Client
	namespaces []string
}

func (r *recordingClient) List(_ context.Context, namespace string, _ resource.ListOptions) (resource.ListObject, error) {
	r.namespaces = append(r.namespaces, namespace)
	return &alertingv0alpha1.RuleSequenceList{}, nil
}

func TestK8sRuleSequenceStore_getClient_retries_on_failure(t *testing.T) {
	gen := &fakeClientGenerator{err: errors.New("apiserver not ready")}
	store := NewK8sRuleSequenceStore(gen, "", log.NewNopLogger())

	// First call should fail and propagate the error.
	_, err := store.GetRuleSequencesForScheduling(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "apiserver not ready")
	assert.Equal(t, 1, gen.calls)

	// Second call should retry (error is not cached).
	_, err = store.GetRuleSequencesForScheduling(context.Background())
	require.Error(t, err)
	assert.Equal(t, 2, gen.calls, "expected retry after transient failure")

	// Simulate recovery: generator stops returning errors.
	gen.err = nil
	client, err := store.getClient()
	require.NoError(t, err)
	require.NotNil(t, client, "expected non-nil client after recovery")
	assert.Equal(t, 3, gen.calls)

	// After success, client is cached: no more calls to generator.
	client2, err := store.getClient()
	require.NoError(t, err)
	assert.Same(t, client, client2, "expected same cached client")
	assert.Equal(t, 3, gen.calls, "expected cached client, no new generator call")
}

func TestRuleSequenceNamespace(t *testing.T) {
	t.Run("cloud scopes the list to the stack namespace", func(t *testing.T) {
		assert.Equal(t, "stacks-12345", RuleSequenceNamespace(&setting.Cfg{StackID: "12345"}))
	})

	t.Run("on-prem lists across all namespaces so every org is scheduled", func(t *testing.T) {
		assert.Empty(t, RuleSequenceNamespace(&setting.Cfg{}))
		assert.Empty(t, RuleSequenceNamespace(nil))
	})
}

func TestK8sRuleSequenceStore_listsInConfiguredNamespace(t *testing.T) {
	for _, tc := range []struct {
		name      string
		namespace string
	}{
		{name: "cloud lists only its own stack", namespace: "stacks-12345"},
		{name: "on-prem lists across all namespaces", namespace: ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cli := &recordingClient{}
			store := NewK8sRuleSequenceStore(&fakeClientGenerator{client: cli}, tc.namespace, log.NewNopLogger())

			_, err := store.GetRuleSequencesForScheduling(context.Background())
			require.NoError(t, err)
			assert.Equal(t, []string{tc.namespace}, cli.namespaces)
		})
	}
}

func TestConvertRuleSequence(t *testing.T) {
	tests := []struct {
		name    string
		seq     alertingv0alpha1.RuleSequence
		want    models.SchedulableRuleSequence
		wantErr string
	}{
		{
			name: "recording and alerting rules converted",
			seq: alertingv0alpha1.RuleSequence{
				ObjectMeta: metav1.ObjectMeta{Name: "seq-1"},
				Spec: alertingv0alpha1.RuleSequenceSpec{
					Trigger: alertingv0alpha1.RuleSequenceIntervalTrigger{
						Interval: alertingv0alpha1.RuleSequencePromDuration("30s"),
					},
					RecordingRules: []alertingv0alpha1.RuleSequenceRuleRef{
						{Name: "rec-1"}, {Name: "rec-2"},
					},
					AlertingRules: []alertingv0alpha1.RuleSequenceRuleRef{
						{Name: "alert-1"},
					},
				},
			},
			want: models.SchedulableRuleSequence{
				UID:               "seq-1",
				IntervalSeconds:   30,
				RecordingRuleRefs: []string{"rec-1", "rec-2"},
				AlertRuleRefs:     []string{"alert-1"},
			},
		},
		{
			name: "recording only sequence with minute interval",
			seq: alertingv0alpha1.RuleSequence{
				ObjectMeta: metav1.ObjectMeta{Name: "seq-rec-only"},
				Spec: alertingv0alpha1.RuleSequenceSpec{
					Trigger: alertingv0alpha1.RuleSequenceIntervalTrigger{
						Interval: alertingv0alpha1.RuleSequencePromDuration("1m"),
					},
					RecordingRules: []alertingv0alpha1.RuleSequenceRuleRef{
						{Name: "rec-1"},
					},
				},
			},
			want: models.SchedulableRuleSequence{
				UID:               "seq-rec-only",
				IntervalSeconds:   60,
				RecordingRuleRefs: []string{"rec-1"},
				AlertRuleRefs:     []string{},
			},
		},
		{
			name: "invalid interval returns error",
			seq: alertingv0alpha1.RuleSequence{
				ObjectMeta: metav1.ObjectMeta{Name: "seq-bad"},
				Spec: alertingv0alpha1.RuleSequenceSpec{
					Trigger: alertingv0alpha1.RuleSequenceIntervalTrigger{
						Interval: alertingv0alpha1.RuleSequencePromDuration("not-a-duration"),
					},
					RecordingRules: []alertingv0alpha1.RuleSequenceRuleRef{
						{Name: "rec-1"},
					},
				},
			},
			wantErr: "invalid interval",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := convertRuleSequence(tc.seq)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}
