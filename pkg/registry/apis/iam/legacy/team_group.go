package legacy

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

// ErrTeamGroupAlreadyAdded maps unique-constraint violations to HTTP 409.
var ErrTeamGroupAlreadyAdded = errors.New("group is already associated with this team")

// ExternalGroupReconciler owns team_group writes done inside the team
// Create/Update/Delete tx. All mutating methods must run on the caller's tx
// and MUST NOT open their own.
type ExternalGroupReconciler interface {
	// Validate runs implementation-specific checks. Errors must use
	// apimachinery so admission surfaces them as HTTP 400.
	Validate(groups []string) error

	// Reconcile diffs current rows against desired and bulk INSERTs/DELETEs.
	// `desired` is the post-admission spec; implementations should treat
	// duplicates and whitespace defensively.
	Reconcile(ctx context.Context, tx *session.SessionTx, orgID, teamID int64, desired []string) error

	// ListByTeams hydrates Team.spec.externalGroups on Get/List. Each team's
	// slice must be in lexicographic order; the read path does not re-sort.
	ListByTeams(ctx context.Context, orgID int64, teamUIDs []string) (map[string][]string, error)

	// DeleteAll clears (orgID, teamID) so team_group cleanup commits with the team row delete.
	DeleteAll(ctx context.Context, tx *session.SessionTx, orgID, teamID int64) error
}

// NoopExternalGroupReconciler is the default: every method is a no-op.
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

func (NoopExternalGroupReconciler) DeleteAll(context.Context, *session.SessionTx, int64, int64) error {
	return nil
}
