package resourcepermission

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var (
	errNotImplemented    = errors.New("not supported by this storage backend")
	errEmptyName         = fmt.Errorf("name cannot be empty")
	errNameMismatch      = fmt.Errorf("name mismatch")
	errNamespaceMismatch = fmt.Errorf("namespace mismatch")
	errInvalidSpec       = fmt.Errorf("invalid spec")
)

type grant struct {
	RoleName         string
	AssigneeID       any
	AssignmentTable  string
	AssignmentColumn string
	Action           string
	Scope            string
}

func (g *grant) permission() accesscontrol.Permission {
	p := accesscontrol.Permission{
		Action: g.Action,
		Scope:  g.Scope,
	}
	p.Kind, p.Attribute, p.Identifier = accesscontrol.SplitScope(p.Scope)
	return p
}
