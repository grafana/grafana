package navbarpreferences

import "encoding/json"

type NavbarPreference struct {
	ID             int64  `xorm:"pk autoincr 'id'"`
	OrgID          int64  `xorm:"org_id"`
	UserID         int64  `xorm:"user_id"`
	NavItemID      string `xorm:"nav_item_id"`
	HideFromNavBar bool   `xorm:"hide_from_navbar"`
}

type GetNavbarPreferencesQuery struct {
	OrgID  int64
	UserID int64

	Result *[]NavbarPreference
}

// Commands

// CreateLibraryElementCommand is the command for adding a LibraryElement
type CreateLibraryElementCommand struct {
	FolderID int64           `json:"folderId"`
	Name     string          `json:"name"`
	Model    json.RawMessage `json:"model"`
	Kind     int64           `json:"kind" binding:"Required"`
	UID      string          `json:"uid"`
}
