package accesscontrol

import (
	"errors"
)

var (
	ErrAuthorization = errors.New("user is not authorized")
)
