package state

import (
	"context"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/benbjohnson/clock"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// Not for parallel tests.
type CountingImageService struct {
	Called int
}

func (c *CountingImageService) NewImage(_ context.Context, _ *ngmodels.AlertRule) (*ngmodels.Image, error) {
	c.Called += 1
	return &ngmodels.Image{
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
				Image: &ngmodels.Image{
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
				Image: &ngmodels.Image{
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
				Image: &ngmodels.Image{
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
			mgr := NewManager(&metrics.State{}, nil,
				&FakeRuleReader{}, &FakeInstanceStore{},
				imageService, clock.NewMock(), &FakeHistorian{})
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

func TestStateIsStale(t *testing.T) {
	now := time.Now()
	intervalSeconds := rand.Int63n(10) + 5

	testCases := []struct {
		name           string
		lastEvaluation time.Time
		expectedResult bool
	}{
		{
			name:           "false if last evaluation is now",
			lastEvaluation: now,
			expectedResult: false,
		},
		{
			name:           "false if last evaluation is 1 interval before now",
			lastEvaluation: now.Add(-time.Duration(intervalSeconds)),
			expectedResult: false,
		},
		{
			name:           "false if last evaluation is little less than 2 interval before now",
			lastEvaluation: now.Add(-time.Duration(intervalSeconds) * time.Second * 2).Add(100 * time.Millisecond),
			expectedResult: false,
		},
		{
			name:           "true if last evaluation is 2 intervals from now",
			lastEvaluation: now.Add(-time.Duration(intervalSeconds) * time.Second * 2),
			expectedResult: true,
		},
		{
			name:           "true if last evaluation is 3 intervals from now",
			lastEvaluation: now.Add(-time.Duration(intervalSeconds) * time.Second * 3),
			expectedResult: true,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expectedResult, stateIsStale(now, tc.lastEvaluation, intervalSeconds))
		})
	}
}
