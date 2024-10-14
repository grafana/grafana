package clients

import (
	"context"
	"strconv"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/rendering"
)

var errInvalidRenderKey = errutil.Unauthorized("render-auth.invalid-key", errutil.WithPublicMessage("Invalid Render Key"))

const (
	renderCookieName = "renderKey"
)

var _ authn.ContextAwareClient = new(Render)

func ProvideRender(renderService rendering.Service) *Render {
	return &Render{renderService}
}

type Render struct {
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

	if renderUsr.UserID <= 0 {
		return &authn.Identity{
			ID:              "0",
			Type:            claims.TypeRenderService,
			OrgID:           renderUsr.OrgID,
			OrgRoles:        map[int64]org.RoleType{renderUsr.OrgID: org.RoleType(renderUsr.OrgRole)},
			ClientParams:    authn.ClientParams{SyncPermissions: true},
			LastSeenAt:      time.Now(),
			AuthenticatedBy: login.RenderModule,
		}, nil
	}

	return &authn.Identity{
		ID:              strconv.FormatInt(renderUsr.UserID, 10),
		Type:            claims.TypeUser,
		LastSeenAt:      time.Now(),
		AuthenticatedBy: login.RenderModule,
		ClientParams:    authn.ClientParams{FetchSyncedUser: true, SyncPermissions: true},
	}, nil
}

func (c *Render) IsEnabled() bool {
	return true
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
