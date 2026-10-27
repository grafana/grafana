package sqlstore

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestAfterCommitWithoutTransaction(t *testing.T) {
	for _, session := range []any{nil, (*DBSession)(nil), "unrelated value"} {
		ctx := t.Context()
		if session != nil {
			ctx = context.WithValue(ctx, ContextSessionKey{}, session)
		}
		called := false
		AfterCommit(ctx, func(got context.Context) {
			require.Equal(t, ctx, got)
			called = true
		})
		require.True(t, called)
	}
}

func TestIntegrationAfterCommit(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, outcome := range []string{"commit", "rollback", "commit failure"} {
		t.Run(outcome, func(t *testing.T) {
			store := NewTestStore(t, WithoutMigrator())
			type requestKey struct{}
			ctx := context.WithValue(t.Context(), requestKey{}, "metadata")
			var calls []string
			store.Bus().AddEventListener(func(context.Context, *afterCommitTestEvent) error {
				calls = append(calls, "event")
				return nil
			})
			failure := errors.New("mutation failed")
			err := store.InTransaction(ctx, func(ctx context.Context) error {
				AfterCommit(ctx, func(ctx context.Context) {
					require.False(t, IsInTransaction(ctx))
					require.Equal(t, "metadata", ctx.Value(requestKey{}))
					calls = append(calls, "outer")
				})
				require.NoError(t, store.InTransaction(ctx, func(ctx context.Context) error {
					SessionFromContext(ctx).PublishAfterCommit(&afterCommitTestEvent{})
					AfterCommit(context.WithValue(ctx, requestKey{}, "inner metadata"), func(ctx context.Context) {
						require.False(t, IsInTransaction(ctx))
						require.Equal(t, "metadata", ctx.Value(requestKey{}))
						calls = append(calls, "inner")
					})
					return nil
				}))
				require.Empty(t, calls)
				switch outcome {
				case "rollback":
					return failure
				case "commit failure":
					// End the underlying transaction so the owner's commit must fail.
					tx, err := SessionFromContext(ctx).Tx()
					require.NoError(t, err)
					require.NoError(t, tx.Rollback())
				}
				return nil
			})
			if outcome == "commit" {
				require.NoError(t, err)
				require.Equal(t, []string{"outer", "event", "inner"}, calls)
			} else {
				require.Error(t, err)
				require.Empty(t, calls)
			}
		})
	}
}

type afterCommitTestEvent struct{}
