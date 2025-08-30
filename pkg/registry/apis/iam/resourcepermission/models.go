package resourcepermission

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/authlib/types"
	idStore "github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var (
	timeNow = func() time.Time { return time.Now() }

	errNotImplemented    = errors.New("not supported by this storage backend")
	errEmptyName         = fmt.Errorf("name cannot be empty")
	errNameMismatch      = fmt.Errorf("name mismatch")
	errNamespaceMismatch = fmt.Errorf("namespace mismatch")
	errInvalidSpec       = fmt.Errorf("invalid spec")

	// TODO make this more flexible
	validLevels = map[string]bool{
		"admin": true,
		"edit":  true,
		"view":  true,
	}
)

type IdentityStore interface {
	GetServiceAccountInternalID(ctx context.Context, ns types.NamespaceInfo, query idStore.GetServiceAccountInternalIDQuery) (*idStore.GetServiceAccountInternalIDResult, error)
	GetTeamInternalID(ctx context.Context, ns types.NamespaceInfo, query idStore.GetTeamInternalIDQuery) (*idStore.GetTeamInternalIDResult, error)
	GetUserInternalID(ctx context.Context, ns types.NamespaceInfo, query idStore.GetUserInternalIDQuery) (*idStore.GetUserInternalIDResult, error)
}

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
