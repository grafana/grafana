package legacy

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

// ErrTeamGroupAlreadyAdded is returned on UNIQUE(org_id, team_id, group_id)
// violations so the team store can map it to HTTP 409.
var ErrTeamGroupAlreadyAdded = errors.New("group is already associated with this team")

// ExternalGroupReconciler reconciles team_group rows during a team
// Create/Update SQL transaction. Reconcile must run inside the caller's tx so
// team_group writes commit or roll back with the team row.
type ExternalGroupReconciler interface {
	// Validate runs implementation-specific checks (e.g. enterprise enforces
	// the team_group.group_id NVarchar(190) column width). Must return
	// apimachinery errors so admission surfaces them as HTTP 400.
	Validate(groups []string) error

	// Reconcile diffs current rows against desired and applies bulk
	// INSERT/DELETE through tx. MUST NOT open its own transaction.
	Reconcile(ctx context.Context, tx *session.SessionTx, orgID, teamID int64, desired []string) error

	// ListByTeams returns group IDs per team UID for hydrating
	// Team.spec.externalGroups on Get/List.
	ListByTeams(ctx context.Context, orgID int64, teamUIDs []string) (map[string][]string, error)
}

// NoopExternalGroupReconciler is the OSS default: no validation, no write, no
// hydration.
type NoopExternalGroupReconciler struct{}

func (NoopExternalGroupReconciler) Validate(_ []string) error {
	return nil
}

func (NoopExternalGroupReconciler) Reconcile(context.Context, *session.SessionTx, int64, int64, []string) error {
	return nil
}

func (NoopExternalGroupReconciler) ListByTeams(_ context.Context, _ int64, teamUIDs []string) (map[string][]string, error) {
	return make(map[string][]string, len(teamUIDs)), nil
}

// NormalizeExternalGroups is the canonical form for team_group.group_id:
// lowercase, trimmed, no empties, deduped. Applied by the legacy team store
// before Reconcile; admission compares entries using the same rule.
func NormalizeExternalGroups(groups []string) []string {
	if len(groups) == 0 {
		return groups
	}
	seen := make(map[string]struct{}, len(groups))
	out := make([]string, 0, len(groups))
	for _, g := range groups {
		g = strings.ToLower(strings.TrimSpace(g))
		if g == "" {
			continue
		}
		if _, dup := seen[g]; dup {
			continue
		}
		seen[g] = struct{}{}
		out = append(out, g)
	}
	return out
}
