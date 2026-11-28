package legacypermissions

import (
	"context"
	"crypto/sha256"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// remoteCachedTeams caches the grants of the whole team set under one key and
// loads them with one query, as the AuthZ RBAC service does for a user's teams.
// With a shared cache, a call then needs one cache round trip, not one per team.
// A membership change selects a different key; a grant change on any team in the
// set is visible after at most the TTL.
func (l *Loader) remoteCachedTeams(ctx context.Context, user identity.Requester, options ac.Options, settings loadSettings) ([][]ac.Permission, error) {
	teamIDs := slices.Clone(user.GetTeams())
	slices.Sort(teamIDs)
	teamIDs = slices.Compact(teamIDs)
	loaded := false
	// Count cache results in teams on the parent cache.teams span, as the batch path does.
	defer func() {
		misses := 0
		if loaded {
			misses = len(teamIDs)
		}
		trace.SpanFromContext(ctx).SetAttributes(
			attribute.Int("team.count", len(teamIDs)),
			attribute.Int("cache.hits", len(teamIDs)-misses),
			attribute.Int("cache.misses", misses),
			attribute.Bool("cache.bypassed", l.permissionCacheTTL() <= 0),
		)
	}()
	if len(teamIDs) == 0 {
		return nil, nil
	}
	permissions, err := l.cached(ctx, "teams", teamSetCacheKey(user.GetOrgID(), teamIDs), options, func(ctx context.Context) ([]ac.Permission, error) {
		loaded = true
		q := queryFor(user.GetOrgID(), settings)
		q.TeamIDs = teamIDs
		q.ExcludeRedundantManagedPermissions = false
		teams, err := l.store.teams(ctx, q)
		if err != nil {
			return nil, err
		}
		count := 0
		for _, grants := range teams {
			count += len(grants)
		}
		combined := make([]ac.Permission, 0, count)
		for _, teamID := range teamIDs {
			combined = append(combined, teams[teamID]...)
		}
		return l.actions.ExpandActionSets(combined), nil
	})
	if err != nil {
		return nil, err
	}
	return [][]ac.Permission{permissions}, nil
}

// teamSetCacheKey hashes the sorted, unique team IDs so that the key length
// stays inside the memcached limit of 250 bytes for any number of teams.
func teamSetCacheKey(orgID int64, teamIDs []int64) string {
	ids := make([]string, len(teamIDs))
	for i, id := range teamIDs {
		ids[i] = strconv.FormatInt(id, 10)
	}
	return fmt.Sprintf("rbac-permissions-team-set-%d-%x", orgID, sha256.Sum256([]byte(strings.Join(ids, ","))))
}
