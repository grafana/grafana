package authn

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

const (
	ClientAnonymous = "auth.anonymous"
)

type Service interface {
	Authenticate(ctx context.Context, client string, r *Request) (*Identity, error)
}

type Client interface {
	Authenticate(ctx context.Context, r *Request) (*Identity, error)
}

type Request struct {
	HTTPRequest *http.Request
}

type Identity struct {
	OrgID       int64
	OrgName     string
	IsAnonymous bool
	OrgRoles    map[int64]org.RoleType
}

func (i *Identity) Role() org.RoleType {
	return i.OrgRoles[i.OrgID]
}

func (i *Identity) SignedInUser() *user.SignedInUser {
	return &user.SignedInUser{
		OrgID:       i.OrgID,
		OrgName:     i.OrgName,
		OrgRole:     i.Role(),
		IsAnonymous: i.IsAnonymous,
	}
}
