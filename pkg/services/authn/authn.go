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
	APIKeyIDPrefix         = "api-key:"
	ServiceAccountIDPrefix = "service-account:"
)

type Identity struct {
	ID       string
	OrgID    int64
	OrgName  string
	OrgRoles map[int64]org.RoleType
}

func (i *Identity) Role() org.RoleType {
	return i.OrgRoles[i.OrgID]
}

func (i *Identity) IsAnonymous() bool {
	return i.ID == ""
}

func (i *Identity) SignedInUser() *user.SignedInUser {
	u := &user.SignedInUser{
		OrgID:       i.OrgID,
		OrgName:     i.OrgName,
		OrgRole:     i.Role(),
		IsAnonymous: i.IsAnonymous(),
	}

	// For now, we need to set different fields of the signed-in user based on the identity "type"
	if strings.HasPrefix(i.ID, APIKeyIDPrefix) {
		id, _ := strconv.ParseInt(strings.TrimPrefix(i.ID, APIKeyIDPrefix), 10, 64)
		u.ApiKeyID = id
	} else if strings.HasPrefix(i.ID, ServiceAccountIDPrefix) {
		id, _ := strconv.ParseInt(strings.TrimPrefix(i.ID, ServiceAccountIDPrefix), 10, 64)
		u.UserID = id
	}

	return u
}
