package legacypermissions

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func (l *Loader) remoteCachedTeams(ctx context.Context, user identity.Requester, options ac.Options, settings loadSettings) ([][]ac.Permission, error) {
	var result [][]ac.Permission
	seen := make(map[int64]bool)
	misses := 0
	// Summarize per-team cache results on the parent cache.teams span, as the batch path does.
	defer func() {
		trace.SpanFromContext(ctx).SetAttributes(
			attribute.Int("team.count", len(seen)),
			attribute.Int("cache.hits", len(seen)-misses),
			attribute.Int("cache.misses", misses),
			attribute.Bool("cache.bypassed", l.permissionCacheTTL() <= 0),
		)
	}()
	for _, teamID := range user.GetTeams() {
		if seen[teamID] {
			continue
		}
		seen[teamID] = true
		// Serialize refreshes and cache fills under the same tenant-specific lock.
		permissions, err := l.cached(ctx, "team", ac.GetTeamPermissionCacheKey(teamID, user.GetOrgID()), options, func(ctx context.Context) ([]ac.Permission, error) {
			misses++
			q := queryFor(user.GetOrgID(), settings)
			q.TeamIDs = []int64{teamID}
			q.ExcludeRedundantManagedPermissions = false
			teams, err := l.store.teams(ctx, q)
			if err != nil {
				return nil, err
			}
			return l.actions.ExpandActionSets(teams[teamID]), nil
		})
		if err != nil {
			return nil, err
		}
		result = append(result, permissions)
	}
	return result, nil
}
