package navbarpreferences

type NavbarPreference struct {
	ID             int64  `xorm:"pk autoincr 'id'"`
	OrgID          int64  `xorm:"org_id"`
	UserID         int64  `xorm:"user_id"`
	NavItemID      string `xorm:"nav_item_id"`
	HideFromNavbar bool   `xorm:"hide_from_navbar"`
}

type NavbarPreferenceDTO struct {
	ID             int64  `json:"id"`
	OrgID          int64  `json:"orgId"`
	UserID         int64  `json:"userId"`
	NavItemID      string `json:"navItemId"`
	HideFromNavbar bool   `json:"hideFromNavbar"`
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
	HideFromNavbar bool   `json:"hideFromNavbar"`
}

// PatchNavbarPreference is the command for updating a NavbarPreference
// e.g. when showing/hiding a navbar item
type PatchNavbarPreferenceCommand struct {
	NavItemID      string `json:"navItemId"`
	HideFromNavbar bool   `json:"hideFromNavbar"`
}
