package clients

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrInvalidRenderKey = errutil.NewBase(errutil.StatusUnauthorized, "render-auth.invalid-key", errutil.WithPublicMessage("Invalid Render Key"))
)

const (
	renderCookieName = "renderKey"
)

var _ authn.Client = new(Render)

func ProvideRender(userService user.Service, renderService rendering.Service) *Render {
	return &Render{userService, renderService}
}

type Render struct {
	userService   user.Service
	renderService rendering.Service
}

func (c *Render) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	key := getRenderKey(r)
	renderUsr, ok := c.renderService.GetRenderUser(ctx, key)
	if !ok {
		return nil, ErrInvalidRenderKey.Errorf("found no render user for key: %s", key)
	}

	if renderUsr.UserID <= 0 {
		return &authn.Identity{
			ID:           authn.NamespacedID(authn.NamespaceUser, 0),
			OrgID:        renderUsr.OrgID,
			OrgRoles:     map[int64]org.RoleType{renderUsr.OrgID: org.RoleType(renderUsr.OrgRole)},
			ClientParams: authn.ClientParams{},
		}, nil
	}

	usr, err := c.userService.GetSignedInUserWithCacheCtx(ctx, &user.GetSignedInUserQuery{UserID: renderUsr.UserID, OrgID: renderUsr.OrgID})
	if err != nil {
		return nil, err
	}
	return authn.IdentityFromSignedInUser(authn.NamespacedID(authn.NamespaceUser, usr.UserID), usr, authn.ClientParams{}), nil
}

func (c *Render) Test(ctx context.Context, r *authn.Request) bool {
	if r.HTTPRequest == nil {
		return false
	}
	return getRenderKey(r) != ""
}

func getRenderKey(r *authn.Request) string {
	cookie, err := r.HTTPRequest.Cookie(renderCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}
