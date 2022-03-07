package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
)

type SaveDashboardRequest struct {
	Path    string
	User    *models.SignedInUser
	Body    json.RawMessage // []byte
	Message string
}

type DashboardStore interface {
	// Get a single dashboard
	GetDashboard(ctx context.Context, user *models.SignedInUser, path string) (*dtos.DashboardFullWithMeta, error)

	// Called from the UI when a dashboard is saved
	SaveDashboard(ctx context.Context, opts SaveDashboardRequest)

	// Temporary: list items so we can build search index
	ListDashboardsToBuildSearchIndex(ctx context.Context, orgId int64) DashboardBodyIterator
}

//--------------------------------------------
//--------------------------------------------

// TEMPORARY! internally, used for listing and building an index
type DashboardQueryResultForSearchIndex struct {
	Id       int64
	IsFolder bool   `xorm:"is_folder"`
	FolderID int64  `xorm:"folder_id"`
	Slug     string `xorm:"slug"` // path when GIT/ETC
	Data     []byte
	Created  time.Time
	Updated  time.Time
}

type DashboardBodyIterator func() *DashboardQueryResultForSearchIndex

// Returned from the main UI
type StorageStatus struct {
	OrgID  int64         `json:"orgId"`
	Config StorageConfig `json:"config"`
}
