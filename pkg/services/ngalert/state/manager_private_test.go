package state

import (
	"context"
	"fmt"
	"math/rand"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/stretchr/testify/require"
)

// Not for parallel tests.
type CountingImageService struct {
	Called int
}

func (c *CountingImageService) NewImage(_ context.Context, _ *ngmodels.AlertRule) (*store.Image, error) {
	c.Called += 1
	return &store.Image{
		Token: fmt.Sprint(rand.Int()),
	}, nil
}

func Test_maybeNewImage(t *testing.T) {
	tests := []struct {
		description      string
		shouldScreenshot bool
		state            *State
		oldState         eval.State
	}{
		{
			"Take a screenshot when we change to an alerting state",
			true,
			&State{
				State: eval.Alerting,
				Image: &store.Image{
					Token: "erase me",
				},
			},
			eval.Normal,
		},
		{
			"Take a screenshot if we're already alerting with no image",
			true,
			&State{
				State: eval.Alerting,
			},
			eval.Alerting,
		},
		{
			"Take a screenshot if we're resolved.",
			true,
			&State{
				Resolved: true,
				State:    eval.Normal,
				Image: &store.Image{
					Token: "abcd",
				},
			},
			eval.Alerting,
		},
		{
			"Don't take a screenshot if we already have one.",
			false,
			&State{
				State: eval.Alerting,
				Image: &store.Image{
					Token: "already set",
				},
			},
			eval.Alerting,
		},
		{
			"Don't take a screenshot if we're pending.",
			false,
			&State{
				State: eval.Pending,
			},
			eval.Normal,
		},
	}

	for _, test := range tests {
		t.Run(test.description, func(t *testing.T) {
			imageService := &CountingImageService{}
			mgr := NewManager(log.NewNopLogger(), &metrics.State{}, nil,
				&store.FakeRuleStore{}, &store.FakeInstanceStore{}, mockstore.NewSQLStoreMock(),
				&dashboards.FakeDashboardService{}, imageService)
			err := mgr.maybeTakeScreenshot(context.Background(), &ngmodels.AlertRule{}, test.state, test.oldState)
			require.NoError(t, err)
			if !test.shouldScreenshot {
				require.Equal(t, 0, imageService.Called)
			} else {
				require.Equal(t, 1, imageService.Called)
				require.NotNil(t, test.state.Image)
			}
		})
	}
}
