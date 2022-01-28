package models

type NavbarPreferences struct {
	Id           int64
	OrgId        int64
	UserId       int64
	NavItemId    string
	ShowInNavbar bool
}

// ---------------------
// QUERIES

type GetNavbarPreferencesQuery struct {
	Id     int64
	OrgId  int64
	UserId int64

	Result *[]NavbarPreferences
}

type GetNavbarPreferencesWithDefaultsQuery struct {
	User *SignedInUser

	Result *NavbarPreferences
}

// ---------------------
// COMMANDS
type SaveNavbarPreferencesCommand struct {
	UserId       int64
	OrgId        int64
	NavItemId    string
	ShowInNavbar bool `json:"showInNavbar"`
}
