package social

import (
	"errors"
	"fmt"
)

var (
	ErrIDTokenNotFound = errors.New("id_token not found")
	ErrEmailNotFound   = errors.New("error getting user info: no email found in access token")
)

type InvalidBasicRoleError struct {
	idP          string
	assignedRole string
}

func (e *InvalidBasicRoleError) Error() string {
	withFallback := func(v, fallback string) string {
		if v == "" {
			return fallback
		}
		return v
	}
	return fmt.Sprintf("Integration requires a valid org role assigned in %s. Assigned role: %s", withFallback(e.idP, "idP"), withFallback(e.assignedRole, "\" \""))
}

func (e *InvalidBasicRoleError) Unwrap() error {
	return &Error{e.Error()}
}
