package parity

import (
	"context"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/team"
)

// shadowReadTimeout caps how long a shadow-read can block its own goroutine.
// Picked to match the precedent set by compareSearchResults
// (pkg/storage/unified/resource/search_client.go:20) — a generous bound for
// a single-resource fetch, deliberately not user-tunable in v0.
const shadowReadTimeout = 500 * time.Millisecond

// ModeProvider exposes the current dual-writer mode for labeling. Threading
// the live mode through (rather than baking it in at construction time) lets
// us label metrics correctly across a config reload or migration.
type ModeProvider interface {
	DualWriterMode(ctx context.Context) int
}

// staticModeProvider returns a fixed mode regardless of context. Useful for
// tests and as a default when no live source is wired.
type staticModeProvider int

func (m staticModeProvider) DualWriterMode(_ context.Context) int { return int(m) }

// StaticMode returns a ModeProvider that reports a fixed mode. Used in tests
// and when the comparator is constructed in a context where the real mode is
// not introspectable (the v0 wiring case).
func StaticMode(mode int) ModeProvider { return staticModeProvider(mode) }

// Comparator decorates a team.Service. The primary service does the real
// work; legacy and k8s are used only for shadow reads after writes succeed.
//
// In normal operation, every Comparator method behaves identically to the
// primary's. The shadow comparison is fire-and-forget — it runs in a
// background goroutine and never blocks the caller or surfaces an error.
type Comparator struct {
	primary team.Service
	legacy  team.Service
	k8s     team.Service
	modes   ModeProvider
	logger  log.Logger

	// enabled gates shadow execution. When false, the Comparator is a pure
	// passthrough — useful for rolling the feature out without redeploying.
	enabled func(ctx context.Context) bool
}

// New returns a Comparator that delegates to `primary` for all operations
// and uses `legacy` and `k8s` for shadow reads after writes. `enabled`
// controls whether the shadow comparison runs at all on a per-request basis.
//
// `primary` is the service that actually serves the request — typically
// teamimpl.Service, which routes between legacy and k8s based on the
// kubernetesTeamsRedirect flag.
//
// Constructor naming follows the precedent of NewSearchClient in
// pkg/storage/unified/resource/search_client.go (the pattern this package
// mirrors). A Wire-discoverable `ProvideComparator` is the natural next
// step when this is integrated into the DI graph.
func New(primary, legacy, k8s team.Service, modes ModeProvider, enabled func(ctx context.Context) bool, logger log.Logger) *Comparator {
	if enabled == nil {
		enabled = func(context.Context) bool { return false }
	}
	if logger == nil {
		logger = log.New("team.parity")
	}
	return &Comparator{
		primary: primary,
		legacy:  legacy,
		k8s:     k8s,
		modes:   modes,
		logger:  logger,
		enabled: enabled,
	}
}

// --- team.Service implementation -------------------------------------------

var _ team.Service = (*Comparator)(nil)

func (c *Comparator) CreateTeam(ctx context.Context, cmd *team.CreateTeamCommand) (team.Team, error) {
	created, err := c.primary.CreateTeam(ctx, cmd)
	if err != nil {
		return created, err
	}
	c.shadowCheck(ctx, "create", created.ID, cmd.OrgID)
	return created, nil
}

func (c *Comparator) UpdateTeam(ctx context.Context, cmd *team.UpdateTeamCommand) error {
	if err := c.primary.UpdateTeam(ctx, cmd); err != nil {
		return err
	}
	c.shadowCheck(ctx, "update", cmd.ID, cmd.OrgID)
	return nil
}

func (c *Comparator) DeleteTeam(ctx context.Context, cmd *team.DeleteTeamCommand) error {
	// Capture identifying info before the delete so we can shadow-read both
	// stores afterward and verify they both reflect the deletion.
	teamID := cmd.ID
	orgID := cmd.OrgID

	if err := c.primary.DeleteTeam(ctx, cmd); err != nil {
		return err
	}
	c.shadowCheckDelete(ctx, teamID, orgID)
	return nil
}

// Read and membership methods are pure passthroughs. Shadow comparison is a
// write-side feature.

func (c *Comparator) SearchTeams(ctx context.Context, q *team.SearchTeamsQuery) (team.SearchTeamQueryResult, error) {
	return c.primary.SearchTeams(ctx, q)
}

func (c *Comparator) GetTeamByID(ctx context.Context, q *team.GetTeamByIDQuery) (*team.TeamDTO, error) {
	return c.primary.GetTeamByID(ctx, q)
}

func (c *Comparator) GetTeamsByUser(ctx context.Context, q *team.GetTeamsByUserQuery) ([]*team.TeamDTO, error) {
	return c.primary.GetTeamsByUser(ctx, q)
}

func (c *Comparator) GetTeamIDsByUser(ctx context.Context, q *team.GetTeamIDsByUserQuery) ([]int64, []string, error) {
	return c.primary.GetTeamIDsByUser(ctx, q)
}

func (c *Comparator) IsTeamMember(ctx context.Context, orgID, teamID, userID int64) (bool, error) {
	return c.primary.IsTeamMember(ctx, orgID, teamID, userID)
}

func (c *Comparator) RemoveUsersMemberships(ctx context.Context, userID int64) error {
	return c.primary.RemoveUsersMemberships(ctx, userID)
}

func (c *Comparator) GetUserTeamMemberships(ctx context.Context, orgID, userID int64, external bool, bypassCache bool) ([]*team.TeamMemberDTO, error) {
	return c.primary.GetUserTeamMemberships(ctx, orgID, userID, external, bypassCache)
}

func (c *Comparator) GetTeamMembers(ctx context.Context, q *team.GetTeamMembersQuery) ([]*team.TeamMemberDTO, error) {
	return c.primary.GetTeamMembers(ctx, q)
}

func (c *Comparator) RegisterDelete(q string) {
	c.primary.RegisterDelete(q)
}

// --- shadow-comparison machinery -------------------------------------------

func (c *Comparator) shadowCheck(ctx context.Context, op string, teamID, orgID int64) {
	if !c.enabled(ctx) {
		return
	}

	// Use WithoutCancel + a bounded timeout so the shadow read survives the
	// caller's HTTP request lifecycle without leaking goroutines indefinitely.
	bgCtx := context.WithoutCancel(ctx)
	mode := c.modeLabel(ctx)

	go func() {
		bgCtx, cancel := context.WithTimeout(bgCtx, shadowReadTimeout)
		defer cancel()

		legacyTeam, legacyErr := c.legacy.GetTeamByID(bgCtx, &team.GetTeamByIDQuery{ID: teamID, OrgID: orgID})
		k8sTeam, k8sErr := c.k8s.GetTeamByID(bgCtx, &team.GetTeamByIDQuery{ID: teamID, OrgID: orgID})

		result := classify(legacyTeam, legacyErr, k8sTeam, k8sErr)
		teamParityCheckTotal.WithLabelValues(op, mode, result).Inc()

		if result == "mismatch" {
			c.logger.Warn("team parity mismatch",
				"operation", op,
				"mode", mode,
				"teamID", teamID,
				"legacy", summarize(legacyTeam),
				"k8s", summarize(k8sTeam),
			)
		}
	}()
}

func (c *Comparator) shadowCheckDelete(ctx context.Context, teamID, orgID int64) {
	if !c.enabled(ctx) {
		return
	}

	bgCtx := context.WithoutCancel(ctx)
	mode := c.modeLabel(ctx)

	go func() {
		bgCtx, cancel := context.WithTimeout(bgCtx, shadowReadTimeout)
		defer cancel()

		_, legacyErr := c.legacy.GetTeamByID(bgCtx, &team.GetTeamByIDQuery{ID: teamID, OrgID: orgID})
		_, k8sErr := c.k8s.GetTeamByID(bgCtx, &team.GetTeamByIDQuery{ID: teamID, OrgID: orgID})

		// After delete, both stores should report the team as not-found.
		// Anything else is a partial-delete (and worth alerting on).
		result := classifyDelete(legacyErr, k8sErr)
		teamParityCheckTotal.WithLabelValues("delete", mode, result).Inc()

		if result == "mismatch" {
			c.logger.Warn("team parity mismatch on delete",
				"mode", mode,
				"teamID", teamID,
				"legacy_err", legacyErr,
				"k8s_err", k8sErr,
			)
		}
	}()
}

func (c *Comparator) modeLabel(ctx context.Context) string {
	if c.modes == nil {
		return "unknown"
	}
	return strconv.Itoa(c.modes.DualWriterMode(ctx))
}

// --- comparison logic ------------------------------------------------------

// classify is exported indirectly via tests; keeping it package-private so we
// don't accidentally make it part of any contract.
func classify(legacyTeam *team.TeamDTO, legacyErr error, k8sTeam *team.TeamDTO, k8sErr error) string {
	switch {
	case legacyErr != nil && k8sErr != nil:
		return "both_errors"
	case legacyErr != nil:
		return "legacy_error"
	case k8sErr != nil:
		return "k8s_error"
	case legacyTeam == nil && k8sTeam == nil:
		// Read-back found nothing in either store. Treat as a mismatch on
		// non-delete ops — the write should have produced something.
		return "mismatch"
	case legacyTeam == nil:
		return "missing_legacy"
	case k8sTeam == nil:
		return "missing_k8s"
	case semanticallyEqual(legacyTeam, k8sTeam):
		return "match"
	default:
		return "mismatch"
	}
}

func classifyDelete(legacyErr, k8sErr error) string {
	legacyGone := legacyErr != nil
	k8sGone := k8sErr != nil
	switch {
	case legacyGone && k8sGone:
		return "match" // both stores agree the team is gone
	case legacyGone:
		return "missing_k8s" // k8s still has it
	case k8sGone:
		return "missing_legacy" // legacy still has it
	default:
		return "mismatch" // neither deleted
	}
}

// semanticallyEqual checks the fields that should round-trip identically
// across the legacy SQL adapter and the K8s adapter. Excludes:
//   - ID / UID timing artifacts: ID may be 0 from the K8s adapter (Bug A);
//     we ASSERT non-zero separately rather than equality (the comparator
//     would log a mismatch in that case, which is the desired behavior).
//   - MemberCount: read via separate code path; member parity is its own
//     concern and out of scope for v0 write-time parity.
//   - Permission / AccessControl: caller-derived, not storage state.
//   - AvatarURL: derived from email on read; cosmetic.
func semanticallyEqual(a, b *team.TeamDTO) bool {
	if a == nil || b == nil {
		return a == b
	}
	if a.Name != b.Name {
		return false
	}
	if a.Email != b.Email {
		return false
	}
	if a.ExternalUID != b.ExternalUID {
		return false
	}
	if a.IsProvisioned != b.IsProvisioned {
		return false
	}
	if a.OrgID != b.OrgID {
		return false
	}
	// UID equality is part of the contract — both adapters MUST agree on
	// the same UID, since that's the primary identifier post-K8s migration.
	if a.UID != b.UID {
		return false
	}
	return true
}

func summarize(t *team.TeamDTO) map[string]any {
	if t == nil {
		return nil
	}
	return map[string]any{
		"id":            t.ID,
		"uid":           t.UID,
		"name":          t.Name,
		"email":         t.Email,
		"externalUID":   t.ExternalUID,
		"isProvisioned": t.IsProvisioned,
		"orgID":         t.OrgID,
	}
}
