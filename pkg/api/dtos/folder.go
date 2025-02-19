package dtos

import (
	"time"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type Folder struct {
	// Deprecated: use UID instead
	ID            int64                  `json:"id" xorm:"pk autoincr 'id'"`
	UID           string                 `json:"uid" xorm:"uid"`
	OrgID         int64                  `json:"orgId" xorm:"org_id"`
	Title         string                 `json:"title"`
	URL           string                 `json:"url" xorm:"url"`
	HasACL        bool                   `json:"hasAcl" xorm:"has_acl"`
	CanSave       bool                   `json:"canSave"`
	CanEdit       bool                   `json:"canEdit"`
	CanAdmin      bool                   `json:"canAdmin"`
	CanDelete     bool                   `json:"canDelete"`
	CreatedBy     string                 `json:"createdBy"`
	Created       time.Time              `json:"created"`
	UpdatedBy     string                 `json:"updatedBy"`
	Updated       time.Time              `json:"updated"`
	Version       int                    `json:"version,omitempty"`
	AccessControl accesscontrol.Metadata `json:"accessControl,omitempty"`
	// only used if nested folders are enabled
	ParentUID string `json:"parentUid,omitempty"`
	// the parent folders starting from the root going down
	Parents []Folder `json:"parents,omitempty"`

	// When the folder belongs to a repository
	// NOTE: this is only populated when folders are managed by unified storage
	Repository string `json:"repository,omitempty"`
}

type FolderSearchHit struct {
	ID        int64  `json:"id" xorm:"pk autoincr 'id'"`
	UID       string `json:"uid" xorm:"uid"`
	Title     string `json:"title"`
	ParentUID string `json:"parentUid,omitempty"`

	// When the folder belongs to a repository
	// NOTE: this is only populated when folders are managed by unified storage
	Repository string `json:"repository,omitempty"`
}
