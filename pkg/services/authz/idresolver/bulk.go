package idresolver

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"
)

// TeamRef pairs a team's app-platform uid (Kubernetes object name) with its legacy
// internal id.
type TeamRef struct {
	UID string
	ID  int64
}

// TeamLister returns all teams in a namespace, sourced from the app platform (unified
// storage). It is the bulk resolver's data source; the implementation owns the client
// (e.g. a dynamic list), keeping this package free of client plumbing.
type TeamLister interface {
	ListTeams(ctx context.Context, ns claims.NamespaceInfo) ([]TeamRef, error)
}

// bulkResolver answers team lookups from an in-memory index built once at construction.
// It is namespace-scoped (built from one namespace's teams) and only resolves teams;
// other kinds are unsupported. Suited to call sites that resolve many references and can
// amortise a single list over them.
type bulkResolver struct {
	byID  map[int64]string
	byUID map[string]int64
}

var _ Resolver = (*bulkResolver)(nil)

// NewBulkResolver lists every team in the namespace once via lister and indexes them by
// id and uid. Subsequent lookups are served from memory. Teams with a zero id or empty
// uid are skipped.
func NewBulkResolver(ctx context.Context, ns claims.NamespaceInfo, lister TeamLister) (Resolver, error) {
	teams, err := lister.ListTeams(ctx, ns)
	if err != nil {
		return nil, fmt.Errorf("listing teams for bulk resolver: %w", err)
	}

	byID := make(map[int64]string, len(teams))
	byUID := make(map[string]int64, len(teams))
	for _, t := range teams {
		if t.ID == 0 || t.UID == "" {
			continue
		}
		byID[t.ID] = t.UID
		byUID[t.UID] = t.ID
	}
	return &bulkResolver{byID: byID, byUID: byUID}, nil
}

func (r *bulkResolver) IDToUID(_ context.Context, _ claims.NamespaceInfo, kind Kind, id int64) (string, error) {
	if kind != KindTeam {
		return "", fmt.Errorf("bulk resolver only supports teams, got %q", kind)
	}
	uid, ok := r.byID[id]
	if !ok {
		return "", ErrNotFound
	}
	return uid, nil
}

func (r *bulkResolver) UIDToID(_ context.Context, _ claims.NamespaceInfo, kind Kind, uid string) (int64, error) {
	if kind != KindTeam {
		return 0, fmt.Errorf("bulk resolver only supports teams, got %q", kind)
	}
	id, ok := r.byUID[uid]
	if !ok {
		return 0, ErrNotFound
	}
	return id, nil
}
