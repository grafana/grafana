package state

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/component-base/tracing"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func TestSyncPersister_saveAlertStates(t *testing.T) {
	type stateWithReason struct {
		State  eval.State
		Reason string
	}
	create := func(s eval.State, r string) stateWithReason {
		return stateWithReason{
			State:  s,
			Reason: r,
		}
	}
	allStates := [...]stateWithReason{
		create(eval.Normal, ""),
		create(eval.Normal, eval.NoData.String()),
		create(eval.Normal, eval.Error.String()),
		create(eval.Normal, util.GenerateShortUID()),
		create(eval.Alerting, ""),
		create(eval.Pending, ""),
		create(eval.NoData, ""),
		create(eval.Error, ""),
	}

	transitionToKey := map[ngmodels.AlertInstanceKey]StateTransition{}
	transitions := make([]StateTransition, 0)
	for _, fromState := range allStates {
		for i, toState := range allStates {
			tr := StateTransition{
				State: &State{
					State:       toState.State,
					StateReason: toState.Reason,
					Labels:      ngmodels.GenerateAlertLabels(5, fmt.Sprintf("%d--", i)),
				},
				PreviousState:       fromState.State,
				PreviousStateReason: fromState.Reason,
			}
			key, err := tr.GetAlertInstanceKey()
			require.NoError(t, err)
			transitionToKey[key] = tr
			transitions = append(transitions, tr)
		}
	}

	t.Run("should save all transitions if doNotSaveNormalState is false", func(t *testing.T) {
		trace := tracing.NewNoopTracerProvider().Tracer("test")
		_, span := trace.Start(context.Background(), "")
		st := &FakeInstanceStore{}
		syncStatePersister := NewSyncStatePersisiter(&logtest.Fake{}, ManagerCfg{
			InstanceStore:           st,
			MaxStateSaveConcurrency: 1,
		})
		syncStatePersister.Sync(context.Background(), span, transitions, nil)
		savedKeys := map[ngmodels.AlertInstanceKey]ngmodels.AlertInstance{}
		for _, op := range st.RecordedOps() {
			saved := op.(ngmodels.AlertInstance)
			savedKeys[saved.AlertInstanceKey] = saved
		}
		assert.Len(t, transitionToKey, len(savedKeys))

		for key, tr := range transitionToKey {
			assert.Containsf(t, savedKeys, key, "state %s (%s) was not saved but should be", tr.State.State, tr.StateReason)
		}
	})

	t.Run("should not save Normal->Normal if doNotSaveNormalState is true", func(t *testing.T) {
		trace := tracing.NewNoopTracerProvider().Tracer("test")
		_, span := trace.Start(context.Background(), "")
		st := &FakeInstanceStore{}
		syncStatePersister := NewSyncStatePersisiter(&logtest.Fake{}, ManagerCfg{
			InstanceStore:           st,
			MaxStateSaveConcurrency: 1,
		})
		syncStatePersister.Sync(context.Background(), span, transitions, nil)

		savedKeys := map[ngmodels.AlertInstanceKey]ngmodels.AlertInstance{}
		for _, op := range st.RecordedOps() {
			saved := op.(ngmodels.AlertInstance)
			savedKeys[saved.AlertInstanceKey] = saved
		}
		for key, tr := range transitionToKey {
			if tr.State.State == eval.Normal && tr.StateReason == "" && tr.PreviousState == eval.Normal && tr.PreviousStateReason == "" {
				continue
			}
			assert.Containsf(t, savedKeys, key, "state %s (%s) was not saved but should be", tr.State.State, tr.StateReason)
		}
	})
}
