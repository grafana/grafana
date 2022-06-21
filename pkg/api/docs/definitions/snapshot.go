package definitions

import (
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

// swagger:route POST /snapshots snapshots createSnapshot
//
// When creating a snapshot using the API, you have to provide the full dashboard payload including the snapshot data. This endpoint is designed for the Grafana UI.
//
// Snapshot public mode should be enabled or authentication is required.
//
// Responses:
// 200: createSnapshotResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /dashboard/snapshots snapshots getSnapshots
//
// List snapshots.
//
// Responses:
// 200: getSnapshotsResponse
// 500: internalServerError

// swagger:route GET /snapshots/{key} snapshots getSnapshotByKey
//
// Get Snapshot by Key.
//
// Responses:
// 200: snapshotResponse
// 404: notFoundError
// 500: internalServerError

// swagger:route DELETE /snapshots/{key} snapshots deleteSnapshotByKey
//
// Delete Snapshot by Key.
//
// Responses:
// 200: okResponse
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /snapshots-delete/{deleteKey} snapshots deleteSnapshotByDeleteKey
//
// Delete Snapshot by deleteKey.
//
// Snapshot public mode should be enabled or authentication is required.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /snapshot/shared-options snapshots getSnapshotSharingOptions
//
// Get snapshot sharing settings.
//
// Responses:
// 200: getSnapshotSharingOptionsResponse
// 401: unauthorisedError

// swagger:parameters createSnapshot
type CreateSnapshotParams struct {
	// in:body
	// required:true
	Body dashboardsnapshots.CreateDashboardSnapshotCommand `json:"body"`
}

// swagger:parameters getSnapshots
type GetSnapshotsParams struct {
	// Search Query
	// in:query
	Query string `json:"query"`
	// Limit the number of returned results
	// in:query
	// default:1000
	Limit int64 `json:"limit"`
}

// swagger:parameters getSnapshotByKey
type SnapshotByKeyParams struct {
	// in:path
	Key string `json:"key"`
}

// swagger:parameters deleteSnapshotByKey
type DeleteSnapshotByKeyParams struct {
	// in:path
	Key string `json:"key"`
}

// swagger:parameters deleteSnapshotByDeleteKey
type DeleteSnapshotByDeleteKeyParams struct {
	// in:path
	DeleteKey string `json:"deleteKey"`
}

// swagger:response createSnapshotResponse
type CreateSnapshotResponse struct {
	// in:body
	Body struct {
		// Unique key
		Key string `json:"key"`
		// Unique key used to delete the snapshot. It is different from the key so that only the creator can delete the snapshot.
		DeleteKey string `json:"deleteKey"`
		URL       string `json:"url"`
		DeleteUrl string `json:"deleteUrl"`
		// Snapshot id
		ID int64 `json:"id"`
	} `json:"body"`
}

// swagger:response getSnapshotsResponse
type GetSnapshotsResponse struct {
	// in:body
	Body []*dashboardsnapshots.DashboardSnapshotDTO `json:"body"`
}

// swagger:response snapshotResponse
type SnapshotResponse DashboardResponse

// swagger:response getSnapshotSharingOptionsResponse
type GetSnapshotSharingOptionsResponse struct {
	// in:body
	Body struct {
		ExternalSnapshotURL  string `json:"externalSnapshotURL"`
		ExternalSnapshotName string `json:"externalSnapshotName"`
		ExternalEnabled      bool   `json:"externalEnabled"`
	} `json:"body"`
}
