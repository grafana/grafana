package resourcepermission

import (
	"errors"
	"fmt"
)

var (
	errNotImplemented    = errors.New("not supported by this storage backend")
	errEmptyName         = fmt.Errorf("name cannot be empty")
	errNameMismatch      = fmt.Errorf("name mismatch")
	errNamespaceMismatch = fmt.Errorf("namespace mismatch")
	errInvalidSpec       = fmt.Errorf("invalid spec")
)
