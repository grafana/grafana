package legacypermissions

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

func (l *Loader) remoteCachedTeams(ctx context.Context, user identity.Requester, options ac.Options, settings loadSettings) ([][]ac.Permission, error) {
	var result [][]ac.Permission
	seen := make(map[int64]bool)
	for _, teamID := range user.GetTeams() {
		if seen[teamID] {
			continue
		}
		seen[teamID] = true
		// Serialize refreshes and cache fills under the same tenant-specific lock.
		permissions, err := l.cached(ctx, "team", ac.GetTeamPermissionCacheKey(teamID, user.GetOrgID()), options, func(ctx context.Context) ([]ac.Permission, error) {
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
