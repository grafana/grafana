package sqlstore

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationPublishAfterCommitOrder(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, outcome := range []string{"commit", "rollback", "commit failure"} {
		t.Run(outcome, func(t *testing.T) {
			store := NewTestStore(t, WithoutMigrator())
			type requestKey struct{}
			ctx := context.WithValue(t.Context(), requestKey{}, "metadata")
			var calls []string
			store.Bus().AddEventListener(func(ctx context.Context, event *afterCommitTestEvent) error {
				require.False(t, IsInTransaction(ctx))
				require.Equal(t, "metadata", ctx.Value(requestKey{}))
				calls = append(calls, event.name)
				return nil
			})
			failure := errors.New("mutation failed")
			err := store.InTransaction(ctx, func(ctx context.Context) error {
				SessionFromContext(ctx).PublishAfterCommit(&afterCommitTestEvent{name: "outer"})
				require.NoError(t, store.InTransaction(context.WithValue(ctx, requestKey{}, "inner metadata"), func(ctx context.Context) error {
					SessionFromContext(ctx).PublishAfterCommit(&afterCommitTestEvent{name: "inner"})
					return nil
				}))
				require.Empty(t, calls)
				switch outcome {
				case "rollback":
					return failure
				case "commit failure":
					tx, err := SessionFromContext(ctx).Tx()
					require.NoError(t, err)
					require.NoError(t, tx.Rollback())
				}
				return nil
			})
			if outcome == "commit" {
				require.NoError(t, err)
				require.Equal(t, []string{"outer", "inner"}, calls)
			} else {
				require.Error(t, err)
				require.Empty(t, calls)
			}
		})
	}
}

type afterCommitTestEvent struct{ name string }
