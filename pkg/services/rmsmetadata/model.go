package rmsmetadata

import (
	"database/sql"
	"errors"
	"time"
)

// Typed errors
var (
	ErrViewNotFound   = errors.New("View not found")
	ErrViewNameTaken  = errors.New("View name is taken")
	ErrRestUnexpected = errors.New("Unexpected rest failure")
)

type View struct {
	ID              int64 `xorm:"pk autoincr 'id'"`
	Name            string
	Description     string
	TenantID        int64  `xorm:"tenant_id"`
	UserID          int64  `xorm:"user_id"`
	FileKey         string `xorm:"file_key"`
	ItsmCompVersion string `xorm:"itsm_comp_version"`

	Created time.Time
	Updated time.Time

	Deleted    bool          `xorm:"is_deleted"`
	BaseViewID sql.NullInt64 `xorm:"base_view_id"`
}

type ViewsEnabledForInsightFinder struct {
	ID            int64     `xorm:"pk autoincr 'id'"`
	TenantID      int64     `xorm:"tenant_id"`
	SelectedViews string    `xorm:"selected_views"`
	Updated       time.Time `xorm:"updated"`
}
