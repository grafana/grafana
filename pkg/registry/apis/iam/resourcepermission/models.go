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

type grant struct {
	RoleName        string
	AssigneeID      string
	AssignmentTable string
	Action          string
	Scope           string
}
