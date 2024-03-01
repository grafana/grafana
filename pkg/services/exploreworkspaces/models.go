package exploreworkspaces

import (
	"time"
)

type ExploreWorkspace struct {
	UID               string `json:"uid" xorm:"pk 'uid'"`
	Name              string `json:"name" xorm:"name"`
	Description       string `json:"description" xorm:"description"`
	ActiveSnapshotUID string `json:"activeSnapshotUID" xorm:"active_snapshot_uid"`
	OrgId             int64  `json:"orgId" xorm:"org_id"`
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
}

// create a new workspace

type CreateExploreWorkspaceCommand struct {
	Name        string
	Description string
	Config      string
	OrgId       int64
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

type TakeExploreWorkspaceSnapshotCommand struct {
	ExploreWorkspaceUID string
}

type GetExploreWorkspaceSnapshotsCommand struct {
	ExploreWorkspaceUID string
}

type GetExploreWorkspaceSnapshotCommand struct {
	ExploreWorkspaceSnapshotUID string
}
