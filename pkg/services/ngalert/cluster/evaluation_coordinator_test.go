package cluster

import (
	"testing"

	"github.com/stretchr/testify/require"
)

type mockPositionProvider struct {
	position int
}

func (m *mockPositionProvider) Position() int {
	return m.position
}

func TestEvaluationCoordinator_ShouldEvaluate(t *testing.T) {
	testCases := []struct {
		name             string
		provider         ClusterPositionProvider
		expectedEvaluate bool
	}{
		{
			name:             "nil cluster should evaluate",
			provider:         nil,
			expectedEvaluate: true,
		},
		{
			name:             "position 0 should evaluate",
			provider:         &mockPositionProvider{position: 0},
			expectedEvaluate: true,
		},
		{
			name:             "position 1 should not evaluate",
			provider:         &mockPositionProvider{position: 1},
			expectedEvaluate: false,
		},
		{
			name:             "position 2 should not evaluate",
			provider:         &mockPositionProvider{position: 2},
			expectedEvaluate: false,
		},
		{
			name:             "position 10 should not evaluate",
			provider:         &mockPositionProvider{position: 10},
			expectedEvaluate: false,
		},
		{
			name:             "negative position should not evaluate",
			provider:         &mockPositionProvider{position: -1},
			expectedEvaluate: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			coordinator := NewEvaluationCoordinator(tc.provider)

			result := coordinator.ShouldEvaluate()

			require.Equal(t, tc.expectedEvaluate, result)
		})
	}
}
