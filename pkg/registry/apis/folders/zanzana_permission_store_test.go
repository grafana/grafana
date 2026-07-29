package folders

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

// deadlineCapturingClient records whether Mutate received a context with a deadline.
type deadlineCapturingClient struct {
	zanzana.Client
	hasDeadline bool
	deadline    time.Time
}

func (c *deadlineCapturingClient) Mutate(ctx context.Context, _ *authzextv1.MutateRequest) error {
	c.deadline, c.hasDeadline = ctx.Deadline()
	return nil
}

func TestZanzanaPermissionStore_WritesAreBounded(t *testing.T) {
	tests := []struct {
		name string
		call func(store PermissionStore, ctx context.Context) error
	}{
		{
			name: "SetFolderParent",
			call: func(store PermissionStore, ctx context.Context) error {
				return store.SetFolderParent(ctx, "stacks-1", "child", "parent")
			},
		},
		{
			name: "DeleteFolderParents",
			call: func(store PermissionStore, ctx context.Context) error {
				return store.DeleteFolderParents(ctx, "stacks-1", "child")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name+" adds deadline to context without one", func(t *testing.T) {
			client := &deadlineCapturingClient{}
			store := NewZanzanaPermissionStore(client)

			require.NoError(t, tt.call(store, context.Background()))
			require.True(t, client.hasDeadline)
			require.WithinDuration(t, time.Now().Add(defaultWriteTimeout), client.deadline, time.Minute)
		})

		t.Run(tt.name+" keeps earlier caller deadline", func(t *testing.T) {
			client := &deadlineCapturingClient{}
			store := NewZanzanaPermissionStore(client)

			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()

			require.NoError(t, tt.call(store, ctx))
			require.True(t, client.hasDeadline)
			require.WithinDuration(t, time.Now().Add(time.Second), client.deadline, time.Minute)
		})
	}
}
