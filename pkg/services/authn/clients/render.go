package clients

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errInvalidRenderKey = errutil.NewBase(errutil.StatusUnauthorized, "render-auth.invalid-key", errutil.WithPublicMessage("Invalid Render Key"))
)

const (
	renderCookieName = "renderKey"
)

var _ authn.ContextAwareClient = new(Render)

func ProvideRender(userService user.Service, renderService rendering.Service) *Render {
	return &Render{userService, renderService}
}

type Render struct {
	userService   user.Service
	renderService rendering.Service
}

func (c *Render) Name() string {
	return authn.ClientRender
}

func (c *Render) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	key := getRenderKey(r)
	renderUsr, ok := c.renderService.GetRenderUser(ctx, key)
	if !ok {
		return nil, errInvalidRenderKey.Errorf("found no render user for key: %s", key)
	}

	var identity *authn.Identity
	if renderUsr.UserID <= 0 {
		identity = &authn.Identity{
			ID:           authn.NamespacedID(authn.NamespaceUser, 0),
			OrgID:        renderUsr.OrgID,
			OrgRoles:     map[int64]org.RoleType{renderUsr.OrgID: org.RoleType(renderUsr.OrgRole)},
			ClientParams: authn.ClientParams{SyncPermissions: true},
		}
	} else {
		usr, err := c.userService.GetSignedInUserWithCacheCtx(ctx, &user.GetSignedInUserQuery{UserID: renderUsr.UserID, OrgID: renderUsr.OrgID})
		if err != nil {
			return nil, err
		}

		identity = authn.IdentityFromSignedInUser(authn.NamespacedID(authn.NamespaceUser, usr.UserID), usr, authn.ClientParams{SyncPermissions: true})
	}

	identity.LastSeenAt = time.Now()
	identity.AuthModule = login.RenderModule
	return identity, nil
}

func (c *Render) Test(ctx context.Context, r *authn.Request) bool {
	if r.HTTPRequest == nil {
		return false
	}
	return getRenderKey(r) != ""
}

func (c *Render) Priority() uint {
	return 10
}

func getRenderKey(r *authn.Request) string {
	cookie, err := r.HTTPRequest.Cookie(renderCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}
