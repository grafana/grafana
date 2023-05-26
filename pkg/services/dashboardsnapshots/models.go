package dashboardsnapshots

import (
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/user"
)

// DashboardSnapshot model
type DashboardSnapshot struct {
	ID                int64 `xorm:"pk autoincr 'id'"`
	Name              string
	Key               string
	DeleteKey         string
	OrgID             int64 `xorm:"org_id"`
	UserID            int64 `xorm:"user_id"`
	External          bool
	ExternalURL       string `xorm:"external_url"`
	ExternalDeleteURL string `xorm:"external_delete_url"`

	Expires time.Time
	Created time.Time
	Updated time.Time

	Dashboard          *simplejson.Json
	DashboardEncrypted []byte
}

// DashboardSnapshotDTO without dashboard map
type DashboardSnapshotDTO struct {
	ID          int64  `json:"id" xorm:"id"`
	Name        string `json:"name"`
	Key         string `json:"key"`
	OrgID       int64  `json:"orgId" xorm:"org_id"`
	UserID      int64  `json:"userId" xorm:"user_id"`
	External    bool   `json:"external"`
	ExternalURL string `json:"externalUrl" xorm:"external_url"`

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
	ExternalURL       string `json:"-"`
	ExternalDeleteURL string `json:"-"`

	// Define the unique key. Required if `external` is `true`.
	// required:false
	Key string `json:"key"`
	// Unique key used to delete the snapshot. It is different from the `key` so that only the creator can delete the snapshot. Required if `external` is `true`.
	// required:false
	DeleteKey string `json:"deleteKey"`

	OrgID  int64 `json:"-"`
	UserID int64 `json:"-"`

	DashboardEncrypted []byte `json:"-"`
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
}

type DashboardSnapshotsList []*DashboardSnapshotDTO

type GetDashboardSnapshotsQuery struct {
	Name         string
	Limit        int
	OrgID        int64
	SignedInUser *user.SignedInUser
}
