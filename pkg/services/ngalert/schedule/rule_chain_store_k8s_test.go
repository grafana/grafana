package schedule

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	alertingv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// fakeClientGenerator implements resource.ClientGenerator, returning a
// preconfigured error to simulate transient init failures.
type fakeClientGenerator struct {
	calls int
	err   error
}

func (f *fakeClientGenerator) ClientFor(_ resource.Kind) (resource.Client, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	// Return nil client; NewRuleChainClient wraps it. The resulting
	// RuleChainClient cannot serve real requests, but that is fine for
	// testing the lazy-init retry logic (we only check that getClient
	// succeeds, not that the client can list).
	return nil, nil
}

func (f *fakeClientGenerator) GetCustomRouteClient(_ schema.GroupVersion, _ string) (resource.CustomRouteClient, error) {
	return nil, errors.New("not implemented")
}

func TestK8sRuleChainStore_getClient_retries_on_failure(t *testing.T) {
	gen := &fakeClientGenerator{err: errors.New("apiserver not ready")}
	store := NewK8sRuleChainStore(gen, log.NewNopLogger())

	// First call should fail and propagate the error.
	_, err := store.GetRuleChainForScheduling(context.Background())
	require.Error(t, err)
	assert.Contains(t, err.Error(), "apiserver not ready")
	assert.Equal(t, 1, gen.calls)

	// Second call should retry (error is not cached).
	_, err = store.GetRuleChainForScheduling(context.Background())
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

func TestConvertRuleChain(t *testing.T) {
	tests := []struct {
		name    string
		chain   alertingv0alpha1.RuleChain
		want    models.SchedulableRuleChain
		wantErr string
	}{
		{
			name: "recording and alerting rules converted",
			chain: alertingv0alpha1.RuleChain{
				ObjectMeta: metav1.ObjectMeta{Name: "chain-1"},
				Spec: alertingv0alpha1.RuleChainSpec{
					Trigger: alertingv0alpha1.RuleChainIntervalTrigger{
						Interval: alertingv0alpha1.RuleChainPromDuration("30s"),
					},
					RecordingRules: []alertingv0alpha1.RuleChainRuleRef{
						{Uid: "rec-1"}, {Uid: "rec-2"},
					},
					AlertingRules: []alertingv0alpha1.RuleChainRuleRef{
						{Uid: "alert-1"},
					},
				},
			},
			want: models.SchedulableRuleChain{
				UID:               "chain-1",
				IntervalSeconds:   30,
				RecordingRuleRefs: []string{"rec-1", "rec-2"},
				AlertRuleRefs:     []string{"alert-1"},
			},
		},
		{
			name: "recording only chain with minute interval",
			chain: alertingv0alpha1.RuleChain{
				ObjectMeta: metav1.ObjectMeta{Name: "chain-rec-only"},
				Spec: alertingv0alpha1.RuleChainSpec{
					Trigger: alertingv0alpha1.RuleChainIntervalTrigger{
						Interval: alertingv0alpha1.RuleChainPromDuration("1m"),
					},
					RecordingRules: []alertingv0alpha1.RuleChainRuleRef{
						{Uid: "rec-1"},
					},
				},
			},
			want: models.SchedulableRuleChain{
				UID:               "chain-rec-only",
				IntervalSeconds:   60,
				RecordingRuleRefs: []string{"rec-1"},
				AlertRuleRefs:     []string{},
			},
		},
		{
			name: "invalid interval returns error",
			chain: alertingv0alpha1.RuleChain{
				ObjectMeta: metav1.ObjectMeta{Name: "chain-bad"},
				Spec: alertingv0alpha1.RuleChainSpec{
					Trigger: alertingv0alpha1.RuleChainIntervalTrigger{
						Interval: alertingv0alpha1.RuleChainPromDuration("not-a-duration"),
					},
					RecordingRules: []alertingv0alpha1.RuleChainRuleRef{
						{Uid: "rec-1"},
					},
				},
			},
			wantErr: "invalid interval",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := convertRuleChain(tc.chain)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}
