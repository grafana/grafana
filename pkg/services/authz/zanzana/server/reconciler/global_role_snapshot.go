package reconciler

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

const globalRoleSnapshotVersion = 1

type globalRoleSnapshot struct {
	FormatVersion int                                     `json:"format_version"`
	StateVersion  int                                     `json:"state_version"`
	FetchedAt     int64                                   `json:"fetched_at"`
	Permissions   map[string][]*authzextv1.RolePermission `json:"permissions"`
}

func globalRoleSnapshotKey() string {
	// Incompatible replicas must not overwrite each other's last valid snapshot.
	return fmt.Sprintf("snapshot-v%d-state%d", globalRoleSnapshotVersion, stateVersion)
}

// refreshGlobalRolePerms prefers live data, then memory, then a persisted snapshot.
// GlobalRoles share one authority within a cluster, whose SQL database isolates this record.
func (r *Reconciler) refreshGlobalRolePerms(ctx context.Context) (map[string][]*authzextv1.RolePermission, error) {
	perms, err := r.fetchGlobalRolePerms(ctx)
	if err == nil {
		if saveErr := r.saveGlobalRoleSnapshot(ctx, perms); saveErr != nil {
			r.logger.Warn("Failed to persist GlobalRole snapshot", "error", saveErr)
		}
		return perms, nil
	}

	r.metrics.errorsTotal.WithLabelValues("fetch_global_roles").Inc()
	r.logger.Warn("Failed to fetch GlobalRoles, checking previous snapshots", "error", err)
	if cached := r.getGlobalRolePerms(); cached != nil {
		return cached, nil
	}
	snapshot, loadErr := r.readGlobalRoleSnapshot(ctx)
	if loadErr != nil {
		return nil, fmt.Errorf("failed to fetch global roles: %w (snapshot load failed: %v)", err, loadErr)
	}
	if snapshot == nil {
		return nil, fmt.Errorf("failed to fetch global roles and no snapshot is available: %w", err)
	}
	r.logger.Warn("Using persisted GlobalRole snapshot", "fetchedAt", snapshot.FetchedAt, "age", time.Since(time.Unix(snapshot.FetchedAt, 0)))
	return snapshot.Permissions, nil
}

func (r *Reconciler) saveGlobalRoleSnapshot(ctx context.Context, perms map[string][]*authzextv1.RolePermission) error {
	if r.stateStore == nil {
		return nil
	}
	snapshot := globalRoleSnapshot{
		FormatVersion: globalRoleSnapshotVersion,
		StateVersion:  stateVersion,
		FetchedAt:     time.Now().Unix(),
		Permissions:   perms,
	}
	raw, err := json.Marshal(snapshot)
	if err != nil {
		return fmt.Errorf("failed to encode GlobalRole snapshot: %w", err)
	}
	return r.stateStore.SetGlobalRoleSnapshot(ctx, globalRoleSnapshotKey(), string(raw))
}

func (r *Reconciler) readGlobalRoleSnapshot(ctx context.Context) (*globalRoleSnapshot, error) {
	if r.stateStore == nil {
		return nil, nil
	}
	raw, ok, err := r.stateStore.GetGlobalRoleSnapshot(ctx, globalRoleSnapshotKey())
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, nil
	}
	var snapshot globalRoleSnapshot
	if err := json.Unmarshal([]byte(raw), &snapshot); err != nil {
		return nil, fmt.Errorf("failed to decode GlobalRole snapshot: %w", err)
	}
	if snapshot.FormatVersion != globalRoleSnapshotVersion || snapshot.StateVersion != stateVersion {
		return nil, fmt.Errorf("incompatible GlobalRole snapshot version")
	}
	if snapshot.FetchedAt <= 0 || snapshot.Permissions == nil {
		return nil, fmt.Errorf("incomplete GlobalRole snapshot")
	}
	for role, permissions := range snapshot.Permissions {
		if role == "" {
			return nil, fmt.Errorf("GlobalRole snapshot contains an empty role name")
		}
		for _, permission := range permissions {
			if permission == nil || permission.Action == "" {
				return nil, fmt.Errorf("GlobalRole snapshot contains an invalid permission for role %q", role)
			}
		}
	}
	return &snapshot, nil
}
