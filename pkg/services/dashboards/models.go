package dashboards

import (
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
)

// This is a temporary const that will be removed when the nested dashboard
// feature is enabled. Until then, all dashboards' parent folder ID is "0",
// which is the "general" folder.
const GeneralFolderID int64 = 0

type SaveDashboardDTO struct {
	OrgId     int64
	UpdatedAt time.Time
	User      *user.SignedInUser
	Message   string
	Overwrite bool
	Dashboard *models.Dashboard
}

type DashboardSearchProjection struct {
	ID          int64  `xorm:"id"`
	UID         string `xorm:"uid"`
	Title       string
	Slug        string
	Term        string
	IsFolder    bool
	FolderID    int64  `xorm:"folder_id"`
	FolderUID   string `xorm:"folder_uid"`
	FolderSlug  string
	FolderTitle string
	SortMeta    int64
}

type CountDashboardsInFolderQuery struct {
	FolderUID string
}

// Note for reviewers: I wasn't sure what to name this. It's not actually a DTO
type CountDashboardsInFolderRequest struct {
	FolderID int64
	OrgID    int64
}
