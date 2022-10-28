package social

import (
	"errors"
	"fmt"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

var (
	ErrIDTokenNotFound = errors.New("id_token not found")
	ErrEmailNotFound   = errors.New("error getting user info: no email found in access token")
)

type InvalidBasicRoleError struct {
	assignedRole string
}

func (e *InvalidBasicRoleError) Error() string {
	role := e.assignedRole
	if role == "" {
		role = "<Empty>"
	}
	return fmt.Sprintf("integration requires a valid org role assigned in idP. Assigned role: %s", role)
}

func (e *InvalidBasicRoleError) Unwrap() error {
	return &Error{cases.Title(language.Und).String(e.Error())}
}
