package historian

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/stretchr/testify/require"
)

func TestFanoutBackend(t *testing.T) {
	t.Run("querying dispatches to primary", func(t *testing.T) {
		one := &fakeBackend{resp: data.NewFrame("one")}
		two := &fakeBackend{resp: data.NewFrame("two")}
		three := &fakeBackend{resp: data.NewFrame("three")}
		fan := NewFanoutBackend(one, two, three)

		resp, err := fan.Query(context.Background(), ngmodels.HistoryQuery{})

		require.NoError(t, err)
		require.Equal(t, "one", resp.Name)
	})
}

type fakeBackend struct {
	resp *data.Frame
}

func (f *fakeBackend) Record(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error {
	return nil
}

func (f *fakeBackend) Query(ctx context.Context, query ngmodels.HistoryQuery) (*data.Frame, error) {
	return f.resp, nil
}
