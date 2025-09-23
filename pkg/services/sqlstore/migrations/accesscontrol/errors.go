package accesscontrol

import "fmt"

var ErrAddTeamMembershipMigrations = fmt.Errorf("Error migrating team memberships")

type ErrUnknownRole struct {
	key string
}

func (e *ErrUnknownRole) Error() string {
	return fmt.Sprintf("%v: Unable to find role in map: %s", ErrAddTeamMembershipMigrations, e.key)
}

func (e *ErrUnknownRole) Unwrap() error {
	return ErrAddTeamMembershipMigrations
}
