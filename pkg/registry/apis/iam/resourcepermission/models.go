package resourcepermission

import (
	"errors"
	"fmt"
)

var (
	errNotImplemented = errors.New("not supported by this storage backend")
	errEmptyName      = fmt.Errorf("name cannot be empty")
)
