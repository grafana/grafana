package permissioncache

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestServiceRegistersListenersOnce(t *testing.T) {
	events := &countingBus{Bus: bus.ProvideBus(tracing.InitializeTracerForTest())}
	var calls []string
	ac := &eventCacheService{clear: func(identity.Requester) { calls = append(calls, "clear") }, refresh: func(context.Context, identity.Requester) error {
		calls = append(calls, "refresh")
		return nil
	}}
	cache := New(events, ac)
	require.Equal(t, 2, events.registrations)
	for range 2 {
		cache.InvalidateAfterCommit(t.Context(), 1, []int64{7})
		cache.RefreshAfterCommit(t.Context(), &user.SignedInUser{UserID: 7, OrgID: 1})
	}
	require.Equal(t, 2, events.registrations, "scheduling must not register additional listeners")
	require.Equal(t, []string{"clear", "clear", "refresh", "clear", "clear", "refresh"}, calls)
}

func TestIntegrationPermissionCacheEvents(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, outcome := range []string{"commit", "rollback", "commit failure", "refresh failure"} {
		t.Run(outcome, func(t *testing.T) {
			sql := sqlstore.NewTestStore(t, sqlstore.WithoutMigrator())
			type metadataKey struct{}
			ctx := context.WithValue(t.Context(), metadataKey{}, "owner")
			ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
			defer cancel()
			deadline, _ := ctx.Deadline()
			requester := &user.SignedInUser{UserID: 7, OrgID: 1}
			var calls []string
			failure := errors.New("failed")
			ac := &eventCacheService{clear: func(actor identity.Requester) {
				id, err := actor.GetInternalID()
				require.NoError(t, err)
				require.Equal(t, int64(7), id)
				require.Equal(t, int64(1), actor.GetOrgID())
				calls = append(calls, "clear")
			}, refresh: func(ctx context.Context, actor identity.Requester) error {
				require.False(t, sqlstore.IsInTransaction(ctx))
				require.Equal(t, "owner", ctx.Value(metadataKey{}))
				require.Same(t, requester, actor)
				got, _ := ctx.Deadline()
				require.Equal(t, deadline, got)
				calls = append(calls, "refresh")
				if outcome == "refresh failure" {
					return failure
				}
				return nil
			}}
			cache := ProvideService(sql, ac)
			sql.Bus().AddEventListener(func(context.Context, *cacheFollowingEvent) error {
				calls = append(calls, "following event")
				return nil
			})
			err := sql.InTransaction(ctx, func(ctx context.Context) error {
				require.NoError(t, sql.InTransaction(context.WithValue(ctx, metadataKey{}, "inner"), func(ctx context.Context) error {
					ids := []int64{7, 7, 0}
					cache.InvalidateAfterCommit(ctx, 1, ids)
					ids[0], ids[1] = 8, 9
					cache.RefreshAfterCommit(ctx, requester)
					sqlstore.SessionFromContext(ctx).PublishAfterCommit(&cacheFollowingEvent{})
					return nil
				}))
				require.Empty(t, calls)
				if outcome == "rollback" {
					return failure
				}
				if outcome == "commit failure" {
					tx, err := sqlstore.SessionFromContext(ctx).Tx()
					require.NoError(t, err)
					require.NoError(t, tx.Rollback())
				}
				return nil
			})
			if outcome == "rollback" || outcome == "commit failure" {
				require.Error(t, err)
				require.Empty(t, calls)
			} else {
				require.NoError(t, err)
				require.Equal(t, []string{"clear", "clear", "refresh", "following event"}, calls)
			}
		})
	}
}

type countingBus struct {
	bus.Bus
	registrations int
}

func (b *countingBus) AddEventListener(handler bus.HandlerFunc) {
	b.registrations++
	b.Bus.AddEventListener(handler)
}

type cacheFollowingEvent struct{}

type eventCacheService struct {
	accesscontrol.Service
	clear   func(identity.Requester)
	refresh func(context.Context, identity.Requester) error
}

func (s *eventCacheService) ClearUserPermissionCache(actor identity.Requester) { s.clear(actor) }
func (s *eventCacheService) GetUserPermissions(ctx context.Context, actor identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	if !options.ReloadCache {
		return nil, errors.New("expected cache reload")
	}
	return nil, s.refresh(ctx, actor)
}
