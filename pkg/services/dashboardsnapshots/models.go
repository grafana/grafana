package dashboardsnapshots

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

// DashboardSnapshot model
type DashboardSnapshot struct {
	Id                int64
	Name              string
	Key               string
	DeleteKey         string
	OrgId             int64
	UserId            int64
	External          bool
	ExternalUrl       string
	ExternalDeleteUrl string

	Expires time.Time
	Created time.Time
	Updated time.Time

	Dashboard          *simplejson.Json
	DashboardEncrypted []byte
}

// DashboardSnapshotDTO without dashboard map
type DashboardSnapshotDTO struct {
	Id          int64  `json:"id"`
	Name        string `json:"name"`
	Key         string `json:"key"`
	OrgId       int64  `json:"orgId"`
	UserId      int64  `json:"userId"`
	External    bool   `json:"external"`
	ExternalUrl string `json:"externalUrl"`

	Expires time.Time `json:"expires"`
	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`
}

// -----------------
// COMMANDS

// swagger:model
type CreateDashboardSnapshotCommand struct {
	// The complete dashboard model.
	// required:true
	Dashboard *simplejson.Json `json:"dashboard" binding:"Required"`
	// Snapshot name
	// required:false
	Name string `json:"name"`
	// When the snapshot should expire in seconds in seconds. Default is never to expire.
	// required:false
	// default:0
	Expires int64 `json:"expires"`

	// these are passed when storing an external snapshot ref
	// Save the snapshot on an external server rather than locally.
	// required:false
	// default: false
	External          bool   `json:"external"`
	ExternalUrl       string `json:"-"`
	ExternalDeleteUrl string `json:"-"`

	// Define the unique key. Required if `external` is `true`.
	// required:false
	Key string `json:"key"`
	// Unique key used to delete the snapshot. It is different from the `key` so that only the creator can delete the snapshot. Required if `external` is `true`.
	// required:false
	DeleteKey string `json:"deleteKey"`

	OrgId  int64 `json:"-"`
	UserId int64 `json:"-"`

	DashboardEncrypted []byte `json:"-"`

	Result *DashboardSnapshot
}

type DeleteDashboardSnapshotCommand struct {
	DeleteKey string `json:"-"`
}

type DeleteExpiredSnapshotsCommand struct {
	DeletedRows int64
}

type GetDashboardSnapshotQuery struct {
	Key       string
	DeleteKey string

	Result *DashboardSnapshot
}

type DashboardSnapshotsList []*DashboardSnapshotDTO

type GetDashboardSnapshotsQuery struct {
	Name         string
	Limit        int
	OrgId        int64
	SignedInUser *models.SignedInUser

	Result DashboardSnapshotsList
}
