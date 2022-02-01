package navbarpreferences

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
