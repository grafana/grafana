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

// CreateNavbarPreference is the command for adding a NavbarPreference 
type CreateNavbarPreferenceCommand struct {
	NavItemID      string `json:"navItemId"`
	HideFromNavBar bool   `json:"hideFromNavbar"`
}
