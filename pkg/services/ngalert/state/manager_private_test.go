package state

import (
	"context"
	"fmt"
	"math/rand"
	"testing"
	"time"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/require"
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

func TestIsItStale(t *testing.T) {
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
			require.Equal(t, tc.expectedResult, isItStale(now, tc.lastEvaluation, intervalSeconds))
		})
	}
}
