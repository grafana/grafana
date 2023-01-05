package authn

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
	"golang.org/x/oauth2"
)

const (
	ClientAPIKey    = "auth.client.api-key" // #nosec G101
	ClientSession   = "auth.client.session"
	ClientAnonymous = "auth.client.anonymous"
	ClientBasic     = "auth.client.basic"
	ClientRender    = "auth.client.render"
)

type ClientParams struct {
	SyncUser            bool
	AllowSignUp         bool
	EnableDisabledUsers bool
}

type PostAuthHookFn func(ctx context.Context, identity *Identity, r *Request) error

type Service interface {
	// RegisterPostAuthHook registers a hook that is called after a successful authentication.
	RegisterPostAuthHook(hook PostAuthHookFn)
	// Authenticate authenticates a request using the specified client.
	Authenticate(ctx context.Context, client string, r *Request) (*Identity, bool, error)
}

type Client interface {
	// Authenticate performs the authentication for the request
	Authenticate(ctx context.Context, r *Request) (*Identity, error)
	// Test should return true if client can be used to authenticate request
	Test(ctx context.Context, r *Request) bool
}

type Request struct {
	// OrgID will be populated by authn.Service
	OrgID       int64
	HTTPRequest *http.Request

	// for use in post auth hooks
	Resp web.ResponseWriter
}

const (
	NamespaceUser           = "user"
	NamespaceAPIKey         = "api-key"
	NamespaceServiceAccount = "service-account"
)

type Identity struct {
	OrgID    int64
	OrgCount int
	OrgName  string
	OrgRoles map[int64]org.RoleType

	ID             string
	Login          string
	Name           string
	Email          string
	IsGrafanaAdmin *bool
	AuthModule     string // AuthModule is the name of the external system
	AuthID         string // AuthId is the unique identifier for the user in the external system
	LookUpParams   models.UserLookupParams
	IsDisabled     bool
	HelpFlags1     user.HelpFlags1
	LastSeenAt     time.Time
	Teams          []int64

	OAuthToken   *oauth2.Token
	SessionToken *auth.UserToken
	ClientParams ClientParams
}

func (i *Identity) Role() org.RoleType {
	return i.OrgRoles[i.OrgID]
}

// IsAnonymous will return true if no ID is set on the identity
func (i *Identity) IsAnonymous() bool {
	return i.ID == ""
}

// TODO: improve error handling
func (i *Identity) NamespacedID() (string, int64) {
	var (
		id        int64
		namespace string
	)

	split := strings.Split(i.ID, ":")
	if len(split) != 2 {
		return "", -1
	}

	id, errI := strconv.ParseInt(split[1], 10, 64)
	if errI != nil {
		return "", -1
	}

	namespace = split[0]

	return namespace, id
}

func (i *Identity) SignedInUser() *user.SignedInUser {
	var isGrafanaAdmin bool
	if i.IsGrafanaAdmin != nil {
		isGrafanaAdmin = *i.IsGrafanaAdmin
	}

	u := &user.SignedInUser{
		UserID:             0,
		OrgID:              i.OrgID,
		OrgName:            i.OrgName,
		OrgRole:            i.Role(),
		ExternalAuthModule: i.AuthModule,
		ExternalAuthID:     i.AuthID,
		Login:              i.Login,
		Name:               i.Name,
		Email:              i.Email,
		OrgCount:           i.OrgCount,
		IsGrafanaAdmin:     isGrafanaAdmin,
		IsAnonymous:        i.IsAnonymous(),
		IsDisabled:         i.IsDisabled,
		HelpFlags1:         i.HelpFlags1,
		LastSeenAt:         i.LastSeenAt,
		Teams:              i.Teams,
	}

	namespace, id := i.NamespacedID()
	if namespace == NamespaceAPIKey {
		u.ApiKeyID = id
	} else {
		u.UserID = id
		u.IsServiceAccount = namespace == NamespaceServiceAccount
	}

	return u
}

func NamespacedID(namespace string, id int64) string {
	return fmt.Sprintf("%s:%d", namespace, id)
}

func IdentityFromSignedInUser(id string, usr *user.SignedInUser, params ClientParams) *Identity {
	return &Identity{
		ID:             id,
		OrgID:          usr.OrgID,
		OrgName:        usr.OrgName,
		OrgRoles:       map[int64]org.RoleType{usr.OrgID: usr.OrgRole},
		Login:          usr.Login,
		Name:           usr.Name,
		Email:          usr.Email,
		OrgCount:       usr.OrgCount,
		IsGrafanaAdmin: &usr.IsGrafanaAdmin,
		IsDisabled:     usr.IsDisabled,
		HelpFlags1:     usr.HelpFlags1,
		LastSeenAt:     usr.LastSeenAt,
		Teams:          usr.Teams,
		ClientParams:   params,
	}
}
