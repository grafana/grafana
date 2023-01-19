package authnimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authn"
)

func TestQueue(t *testing.T) {
	type testCase struct {
		desc          string
		clients       []authn.ContextAwareClient
		expectedOrder []string
	}

	tests := []testCase{
		{
			desc: "",
			clients: []authn.ContextAwareClient{
				&authntest.FakeClient{ExpectedName: "1", ExpectedPriority: 1},
				&authntest.FakeClient{ExpectedName: "5", ExpectedPriority: 5},
				&authntest.FakeClient{ExpectedName: "3", ExpectedPriority: 3},
				&authntest.FakeClient{ExpectedName: "2", ExpectedPriority: 2},
				&authntest.FakeClient{ExpectedName: "4", ExpectedPriority: 4},
			},
			expectedOrder: []string{"1", "2", "3", "4", "5"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			q := newQueue[authn.ContextAwareClient]()
			for _, c := range tt.clients {
				q.insert(c)
			}

			require.Len(t, q.items, len(tt.expectedOrder))

			for i := range q.items {
				assert.Equal(t, q.items[i].Name(), tt.expectedOrder[i])
			}
		})
	}
}
