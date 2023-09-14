package accesscontrol

import (
	"errors"
)

var (
	ErrAuthorization = errors.New("user is not authorized")
)

type ActionsProvider struct {
	Create string
	Read   string
	Update string
	Delete string
}
