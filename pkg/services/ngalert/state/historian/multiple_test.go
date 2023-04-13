package historian

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/stretchr/testify/require"
)

func TestMultipleBackend(t *testing.T) {
	t.Run("querying dispatches to primary", func(t *testing.T) {
		one := &fakeBackend{resp: data.NewFrame("one")}
		two := &fakeBackend{resp: data.NewFrame("two")}
		three := &fakeBackend{resp: data.NewFrame("three")}
		fan := NewMultipleBackend(one, two, three)

		resp, err := fan.Query(context.Background(), ngmodels.HistoryQuery{})

		require.NoError(t, err)
		require.Equal(t, "one", resp.Name)
	})

	t.Run("writes dispatch to all", func(t *testing.T) {
		one := &fakeBackend{}
		two := &fakeBackend{}
		three := &fakeBackend{}
		fan := NewMultipleBackend(one, two, three)
		rule := history_model.RuleMeta{}
		vs := []state.StateTransition{{}}

		err := <-fan.Record(context.Background(), rule, vs)

		require.NoError(t, err)
		require.NotEmpty(t, one.last)
		require.NotEmpty(t, two.last)
		require.NotEmpty(t, three.last)
	})

	t.Run("writes combine errors", func(t *testing.T) {
		one := &fakeBackend{err: fmt.Errorf("error one")}
		two := &fakeBackend{err: fmt.Errorf("error two")}
		three := &fakeBackend{}
		fan := NewMultipleBackend(one, two, three)
		rule := history_model.RuleMeta{}
		vs := []state.StateTransition{{}}

		err := <-fan.Record(context.Background(), rule, vs)

		require.Error(t, err)
		require.ErrorContains(t, err, "error one")
		require.ErrorContains(t, err, "error two")
	})
}

type fakeBackend struct {
	resp *data.Frame
	err  error
	last []state.StateTransition
}

func (f *fakeBackend) Record(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error {
	ch := make(chan error, 1)
	if f.err != nil {
		ch <- f.err
	}
	f.last = states
	defer close(ch)
	return ch
}

func (f *fakeBackend) Query(ctx context.Context, query ngmodels.HistoryQuery) (*data.Frame, error) {
	return f.resp, f.err
}
