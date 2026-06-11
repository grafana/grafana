// Package idresolver is the shared P2 identity-resolution primitive: it translates an
// identity reference between its legacy numeric id and its app-platform uid (the
// Kubernetes object name), in both directions, for teams, users and service accounts.
//
// One Resolver interface, two implementations chosen by access pattern:
//   - NewResolver does one fetch per lookup (legacy SQL, or an app-platform client for
//     teams when the kubernetesTeamsApi flag is on). Suited to call sites that resolve
//     a handful of references per request, e.g. the role/delegation translations.
//   - NewBulkResolver lists everything up front and answers from memory. Suited to call
//     sites that resolve many references, e.g. the Zanzana reconciler and the
//     legacy<->Zanzana merge.
//
// Both work in mode 5 (no legacy SQL): the single resolver via the team client, the bulk
// resolver via its lister.
package idresolver

import (
	"context"
	"errors"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// ErrNotFound is returned when no identity matches the given id or uid. Callers can
// distinguish it (e.g. to drop an orphaned scope) from a transient lookup failure.
var ErrNotFound = errors.New("identity not found")

// Kind enumerates the identity types the resolver can translate. The values match the
// legacy RBAC scope prefixes (e.g. "teams" in "teams:id:5").
type Kind string

const (
	KindTeam           Kind = "teams"
	KindUser           Kind = "users"
	KindServiceAccount Kind = "serviceaccounts"
)

// Resolver translates a single identity reference between its legacy numeric id and its
// app-platform uid, in both directions. Returns ErrNotFound when the identity is absent.
// Call it in a loop for many references; pick the implementation (single vs bulk) to
// match the access pattern.
type Resolver interface {
	IDToUID(ctx context.Context, ns claims.NamespaceInfo, kind Kind, id int64) (uid string, err error)
	UIDToID(ctx context.Context, ns claims.NamespaceInfo, kind Kind, uid string) (id int64, err error)
}

// TeamClient resolves a single team from the app platform (unified storage). It is the
// mode-5 backing for the single resolver. Implementations must return ErrNotFound for a
// missing team.
type TeamClient interface {
	UIDByID(ctx context.Context, ns claims.NamespaceInfo, id int64) (uid string, err error)
	IDByUID(ctx context.Context, ns claims.NamespaceInfo, uid string) (id int64, err error)
}

// singleResolver resolves one identity per call. Teams go through teamClient when the
// kubernetesTeamsApi flag is enabled, or when no legacy store is configured (e.g. the
// multi-tenant deployment, inherently mode 5); otherwise they use the legacy SQL store.
// Users and service accounts always use the legacy store for now.
type singleResolver struct {
	legacyStore legacy.ScopeResolverStore
	teamClient  TeamClient
}

// NewResolver returns a Resolver that does one fetch per lookup.
func NewResolver(legacyStore legacy.ScopeResolverStore, teamClient TeamClient) Resolver {
	return &singleResolver{legacyStore: legacyStore, teamClient: teamClient}
}

// useTeamClient reports whether team lookups should go through the app-platform client
// instead of legacy SQL. The kubernetesTeamsApi flag is evaluated per-request via
// OpenFeature so cloud/stack targeting is respected.
func (r *singleResolver) useTeamClient(ctx context.Context) bool {
	if r.teamClient == nil {
		return false
	}
	if r.legacyStore == nil {
		return true
	}
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagKubernetesTeamsApi, false, openfeature.TransactionContext(ctx))
}

func (r *singleResolver) IDToUID(ctx context.Context, ns claims.NamespaceInfo, kind Kind, id int64) (string, error) {
	switch kind {
	case KindTeam:
		if r.useTeamClient(ctx) {
			uid, err := r.teamClient.UIDByID(ctx, ns, id)
			return uid, normalizeNotFound(err)
		}
		if r.legacyStore == nil {
			return "", errNoStore(kind)
		}
		res, err := r.legacyStore.GetTeamUIDByID(ctx, ns, legacy.GetTeamUIDByIDQuery{ID: id})
		if err != nil {
			return "", normalizeNotFound(err)
		}
		return res.UID, nil
	case KindUser:
		if r.legacyStore == nil {
			return "", errNoStore(kind)
		}
		res, err := r.legacyStore.GetUserUIDByID(ctx, ns, legacy.GetUserUIDByIDQuery{ID: id})
		if err != nil {
			return "", normalizeNotFound(err)
		}
		return res.UID, nil
	case KindServiceAccount:
		if r.legacyStore == nil {
			return "", errNoStore(kind)
		}
		res, err := r.legacyStore.GetServiceAccountUIDByID(ctx, ns, legacy.GetUserUIDByIDQuery{ID: id, IsServiceAccount: true})
		if err != nil {
			return "", normalizeNotFound(err)
		}
		return res.UID, nil
	default:
		return "", fmt.Errorf("unknown identity kind %q", kind)
	}
}

func (r *singleResolver) UIDToID(ctx context.Context, ns claims.NamespaceInfo, kind Kind, uid string) (int64, error) {
	switch kind {
	case KindTeam:
		if r.useTeamClient(ctx) {
			id, err := r.teamClient.IDByUID(ctx, ns, uid)
			return id, normalizeNotFound(err)
		}
		if r.legacyStore == nil {
			return 0, errNoStore(kind)
		}
		res, err := r.legacyStore.GetTeamInternalID(ctx, ns, legacy.GetTeamInternalIDQuery{UID: uid})
		if err != nil {
			return 0, normalizeNotFound(err)
		}
		return res.ID, nil
	case KindUser:
		if r.legacyStore == nil {
			return 0, errNoStore(kind)
		}
		res, err := r.legacyStore.GetUserInternalID(ctx, ns, legacy.GetUserInternalIDQuery{UID: uid})
		if err != nil {
			return 0, normalizeNotFound(err)
		}
		return res.ID, nil
	case KindServiceAccount:
		if r.legacyStore == nil {
			return 0, errNoStore(kind)
		}
		res, err := r.legacyStore.GetServiceAccountInternalID(ctx, ns, legacy.GetServiceAccountInternalIDQuery{UID: uid})
		if err != nil {
			return 0, normalizeNotFound(err)
		}
		return res.ID, nil
	default:
		return 0, fmt.Errorf("unknown identity kind %q", kind)
	}
}

func errNoStore(kind Kind) error {
	return fmt.Errorf("no resolver configured for kind %q", kind)
}

// normalizeNotFound collapses the various not-found errors (legacy SQL sentinels and
// the client's ErrNotFound) into ErrNotFound so callers test one error.
func normalizeNotFound(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, ErrNotFound) || legacy.IsNotFoundError(err) {
		return ErrNotFound
	}
	return err
}
