package legacy

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

// ErrTeamGroupAlreadyAdded is the sentinel returned by ExternalGroupReconciler
// implementations when a bulk INSERT into team_group hits the
// UNIQUE(org_id, team_id, group_id) constraint. The OSS team store maps it to
// HTTP 409 Conflict so clients can retry.
var ErrTeamGroupAlreadyAdded = errors.New("group is already associated with this team")

// ExternalGroupReconciler reconciles team_group rows for a given team during a
// team Create/Update SQL transaction. The OSS build wires NoopExternalGroupReconciler;
// enterprise wires the real implementation backed by the team_group table.
//
// Reconcile must run inside the caller's tx so the team_group writes commit or
// roll back atomically with the team row write — matching the same-tx
// guarantee the legacy team store keeps for team_member writes.
type ExternalGroupReconciler interface {
	// Reconcile diffs current team_group rows for (orgID, teamID) against the
	// desired group IDs and applies bulk INSERT / bulk DELETE through tx.
	// Implementations MUST NOT open their own transactions.
	Reconcile(ctx context.Context, tx *session.SessionTx, orgID, teamID int64, desired []string) error

	// ListByTeams returns the group IDs per team UID for hydrating
	// Team.spec.externalGroups on Get / List. Read-only.
	ListByTeams(ctx context.Context, orgID int64, teamUIDs []string) (map[string][]string, error)
}

// NoopExternalGroupReconciler is the OSS default. Reconcile is a no-op and
// ListByTeams returns an empty map, so OSS Team responses always carry an
// empty spec.externalGroups.
type NoopExternalGroupReconciler struct{}

func (NoopExternalGroupReconciler) Reconcile(context.Context, *session.SessionTx, int64, int64, []string) error {
	return nil
}

func (NoopExternalGroupReconciler) ListByTeams(_ context.Context, _ int64, teamUIDs []string) (map[string][]string, error) {
	return make(map[string][]string, len(teamUIDs)), nil
}
