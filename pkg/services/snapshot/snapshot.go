// Package snapshot provides a service to store and retrieve a
// particular view of a dashboard at a specific moment.
//
// Snapshots can be stored both locally and on an external Grafana
// snapshot instance.
package snapshot

import "context"

// Service provides the public interface for interacting with snapshots.
type Service interface {
	// Create validates and stores a snapshot, returning the newly
	// stored entity from the store. When CreateCmd.External is true,
	// Create will send the dashboard snapshot to a remote snapshot
	// service and return a thin object containing only metadata about
	// the remote snapshot.
	// TODO: Should create return the full created snapshot or ID only?
	Create(ctx context.Context, cmd *CreateCmd) (*CreateResult, error)
	// Delete permanently deletes a snapshot from the service. If the
	// snapshot is stored on a remote snapshot service, Delete will
	// request the deletion of the remote object and delete the local
	// metadata.
	Delete(ctx context.Context, cmd *DeleteCmd) error
	// GetByKey fetches a single snapshot from the store using either
	// its Key or DeleteKey. If both are provided, they have to point
	// to the same object or an error is raised.
	// Set GetByKeyQuery.IncludeSecrets to true to include the
	// Snapshot.DeleteKey and Snapshot.ExternalDeleteURL properties.
	GetByKey(ctx context.Context, query *GetByKeyQuery) (*GetResult, error)
	// List scans the available snapshots for snapshots that matches
	// ListQuery and returns a SnapshotList containing a list of
	// metadata related to the matching snapshots.
	List(ctx context.Context, query *ListQuery) (*ListResult, error)
	// DeleteExpired tries to delete all snapshots which has a
	// Snapshot.Expires time set to before the current time,
	// returning the number of successfully deleted items.
	DeleteExpired(ctx context.Context) (*DeleteExpiredResult, error)
}
