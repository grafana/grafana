package idresolver

import (
	"context"

	claims "github.com/grafana/authlib/types"
)

// TeamRef pairs a team's app-platform uid (Kubernetes object name) with its legacy
// internal id. It is the unit a bulk TeamClient is built from.
type TeamRef struct {
	UID string
	ID  int64
}

// bulkTeamClient resolves teams from an in-memory index built once from a full team
// list. It satisfies TeamClient and is meant for batch callers (e.g. the Zanzana
// reconciler) that resolve many teams per namespace and prefer a single list over N
// point lookups. It is built for a single namespace's teams, so the ns argument is
// ignored.
type bulkTeamClient struct {
	byID  map[int64]string
	byUID map[string]int64
}

var _ TeamClient = (*bulkTeamClient)(nil)

// NewBulkTeamClient indexes the given teams by id and uid and returns a map-backed
// TeamClient. Entries with a zero id or empty uid are skipped. Compose it with
// NewResolver(nil, client, nil) for a mode-5 batch resolver.
func NewBulkTeamClient(teams []TeamRef) TeamClient {
	byID := make(map[int64]string, len(teams))
	byUID := make(map[string]int64, len(teams))
	for _, t := range teams {
		if t.ID == 0 || t.UID == "" {
			continue
		}
		byID[t.ID] = t.UID
		byUID[t.UID] = t.ID
	}
	return &bulkTeamClient{byID: byID, byUID: byUID}
}

func (c *bulkTeamClient) UIDByID(_ context.Context, _ claims.NamespaceInfo, id int64) (string, error) {
	uid, ok := c.byID[id]
	if !ok {
		return "", ErrNotFound
	}
	return uid, nil
}

func (c *bulkTeamClient) IDByUID(_ context.Context, _ claims.NamespaceInfo, uid string) (int64, error) {
	id, ok := c.byUID[uid]
	if !ok {
		return 0, ErrNotFound
	}
	return id, nil
}
