// Package idresolver is the shared P2 identity-resolution primitive: it translates an
// identity reference between its legacy numeric id and its app-platform uid (the
// Kubernetes object name), in both directions, for teams, users and service accounts.
//
// A single Resolver implementation is meant to back every permission-translation site
// (the Zanzana reconciler, the legacy<->Zanzana merge, the delegation check, v0->v1
// conversion) instead of each re-deriving id<->uid knowledge. It resolves through the
// legacy SQL store by default; for teams it switches to an app-platform client when the
// kubernetesTeamsApi flag is enabled (or when no legacy store is configured), so it
// works in mode 5 with no legacy SQL.
package idresolver

import (
	"context"
	"errors"
	"fmt"

	claims "github.com/grafana/authlib/types"

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

// Resolver translates an identity reference between its legacy numeric id and its
// app-platform uid, in both directions, one at a time or in bulk.
type Resolver interface {
	// IDToUID resolves a legacy numeric id to the uid. Returns ErrNotFound if absent.
	IDToUID(ctx context.Context, ns claims.NamespaceInfo, kind Kind, id int64) (uid string, err error)
	// UIDToID resolves a uid to the legacy numeric id. Returns ErrNotFound if absent.
	UIDToID(ctx context.Context, ns claims.NamespaceInfo, kind Kind, uid string) (id int64, err error)

	// IDsToUIDs resolves many ids in one call. The returned map holds only the ids
	// that resolved; ids with no matching identity are omitted rather than erroring,
	// so a single orphan doesn't fail the batch. A non-not-found failure aborts.
	IDsToUIDs(ctx context.Context, ns claims.NamespaceInfo, kind Kind, ids []int64) (map[int64]string, error)
	// UIDsToIDs is the reverse bulk lookup; unresolved uids are omitted.
	UIDsToIDs(ctx context.Context, ns claims.NamespaceInfo, kind Kind, uids []string) (map[string]int64, error)
}

// TeamClient resolves teams from the app platform (unified storage). It is the mode-5
// backing used when there is no legacy SQL. Implementations must return ErrNotFound
// for a missing team.
type TeamClient interface {
	UIDByID(ctx context.Context, ns claims.NamespaceInfo, id int64) (uid string, err error)
	IDByUID(ctx context.Context, ns claims.NamespaceInfo, uid string) (id int64, err error)
}

type resolver struct {
	legacyStore legacy.ScopeResolverStore
	teamClient  TeamClient
	features    featuremgmt.FeatureToggles
}

// NewResolver returns the default Resolver. Team lookups use teamClient when the
// kubernetesTeamsApi flag is enabled, or when no legacy store is configured (e.g. the
// multi-tenant reconciler, which is inherently mode 5 with no SQL); otherwise they use
// the legacy SQL store. Users and service accounts always use the legacy store for now.
func NewResolver(legacyStore legacy.ScopeResolverStore, teamClient TeamClient, features featuremgmt.FeatureToggles) Resolver {
	return &resolver{legacyStore: legacyStore, teamClient: teamClient, features: features}
}

// useTeamClient reports whether team lookups should go through the app-platform client
// instead of legacy SQL.
func (r *resolver) useTeamClient(ctx context.Context) bool {
	if r.teamClient == nil {
		return false
	}
	if r.legacyStore == nil {
		return true
	}
	return r.features != nil && r.features.IsEnabled(ctx, featuremgmt.FlagKubernetesTeamsApi)
}

func (r *resolver) IDToUID(ctx context.Context, ns claims.NamespaceInfo, kind Kind, id int64) (string, error) {
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

func (r *resolver) UIDToID(ctx context.Context, ns claims.NamespaceInfo, kind Kind, uid string) (int64, error) {
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

func (r *resolver) IDsToUIDs(ctx context.Context, ns claims.NamespaceInfo, kind Kind, ids []int64) (map[int64]string, error) {
	out := make(map[int64]string, len(ids))
	for _, id := range ids {
		if _, done := out[id]; done {
			continue
		}
		uid, err := r.IDToUID(ctx, ns, kind, id)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				continue
			}
			return nil, err
		}
		out[id] = uid
	}
	return out, nil
}

func (r *resolver) UIDsToIDs(ctx context.Context, ns claims.NamespaceInfo, kind Kind, uids []string) (map[string]int64, error) {
	out := make(map[string]int64, len(uids))
	for _, uid := range uids {
		if _, done := out[uid]; done {
			continue
		}
		id, err := r.UIDToID(ctx, ns, kind, uid)
		if err != nil {
			if errors.Is(err, ErrNotFound) {
				continue
			}
			return nil, err
		}
		out[uid] = id
	}
	return out, nil
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
