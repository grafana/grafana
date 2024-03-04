package exploreworkspaces

import (
	"time"

	"github.com/grafana/grafana/pkg/services/user"
)

type ExploreWorkspace struct {
	// static
	UID               string `json:"uid" xorm:"pk 'uid'"`
	Name              string `json:"name" xorm:"name"`
	Description       string `json:"description" xorm:"description"`
	ActiveSnapshotUID string `json:"activeSnapshotUID" xorm:"active_snapshot_uid"`
	UserId            int64  `json:"userId" xorm:"user_id"`
	OrgId             int64  `json:"orgId" xorm:"org_id"`

	// dynamic
	User           *user.User               `json:"user" xorm:"-"`
	ActiveSnapshot ExploreWorkspaceSnapshot `json:"activeSnapshot" xorm:"-"`
}

type ExploreWorkspaceSnapshot struct {
	UID                string    `json:"uid" xorm:"pk 'uid'"`
	ExploreWorspaceUID string    `json:"exploreWorkspaceUID" xorm:"explore_workspace_uid"`
	Name               string    `json:"name" xorm:"name"`
	Description        string    `json:"description" xorm:"description"`
	Created            time.Time `json:"created" xorm:"created"`
	Updated            time.Time `json:"updated" xorm:"updated"`
	UserId             int64     `json:"userId" xorm:"user_id"`
	Config             string    `json:"config" xorm:"config"`
	Version            int64     `json:"version" xorm:"version"`

	// dynamic
	User *user.User `json:"user" xorm:"-"`
}

// create a new workspace

type CreateExploreWorkspaceCommand struct {
	// workspace
	Name        string
	Description string
	OrgId       int64
	UserId      int64

	// snapshot
	Config string
}

type CreateExploreWorkspaceResponse struct {
	UID string `json:"uid"`
}

// get a workspace

type GetExploreWorkspaceCommand struct {
	ExploreWorkspaceUID string
	OrgId               int64
}

type GetExploreWorkspaceResponse struct {
	ExploreWorkspace ExploreWorkspace `json:"exploreWorkspace"`
}

// get all workspaces

type GetExploreWorkspacesCommand struct {
	OrgId int64
}

type GetExploreWorkspacesResponse struct {
	ExploreWorkspaces []ExploreWorkspace `json:"exploreWorkspaces"`
}

//

type CreateExploreWorkspaceSnapshotCommand struct {
	ExploreWorspaceUID string
	OrgId              int64
	Name               string
	Description        string
	Created            time.Time
	Updated            time.Time
	UserId             int64
	Config             string
}

type CreateExploreWorkspaceSnapshotResponse struct {
	CreatedSnapshot ExploreWorkspaceSnapshot `json:"createdSnapshot"`
}

type UpdateExploreWorkspaceLatestSnapshotCommand struct {
	ExploreWorspaceUID string `json:"exploreWorkspaceUID"`
	Updated            time.Time
	UserId             int64
	Config             string `json:"config"`
}

type UpdateExploreWorkspaceLatestSnapshotResponse struct {
	Snapshot ExploreWorkspaceSnapshot `json:"snapshot"`
}

type UpdateExploreWorkspaceSnapshotCommand struct {
	UID         string
	Name        string
	Description string
	Updated     time.Time
	UserId      int64
	Config      string
}

type CreateaExploreWorkspaceSnapshotCommand struct {
	Name                string
	Description         string
	ExploreWorkspaceUID string
}

type GetExploreWorkspaceSnapshotsCommand struct {
	ExploreWorkspaceUID string
}

type GetExploreWorkspaceSnapshotResponse struct {
	Snapshot ExploreWorkspaceSnapshot `json:"snapshot"`
}

type GetExploreWorkspaceSnapshotCommand struct {
	UID string
}

type GetExploreWorkspaceSnapshotsResponse struct {
	Snapshots []ExploreWorkspaceSnapshot `json:"snapshots"`
}
