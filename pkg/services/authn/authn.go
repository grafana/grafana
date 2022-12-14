package authn

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

const (
	ClientAPIKey    = "auth.client.api-key"
	ClientAnonymous = "auth.client.anonymous"
)

type Service interface {
	// Authenticate is used to authenticate using a specific client
	Authenticate(ctx context.Context, client string, r *Request) (*Identity, bool, error)
}

type Client interface {
	// Authenticate performs the authentication for the request
	Authenticate(ctx context.Context, r *Request) (*Identity, error)
	// Test should return true if client can be used to authenticate request
	Test(ctx context.Context, r *Request) bool
}

type Request struct {
	HTTPRequest *http.Request
}

const (
	APIKeyIDPrefix         = "apikey:"
	ServiceAccountIDPrefix = "service-account:"
)

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
