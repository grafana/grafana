package clients

import (
	"context"
	"fmt"
	"strconv"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/rendering"
)

var errInvalidRenderKey = errutil.Unauthorized("render-auth.invalid-key", errutil.WithPublicMessage("Invalid Render Key"))

const (
	MetaAuthenticatedByOverride = "authenticatedByOverride"
	renderCookieName            = "renderKey"
)

var _ authn.ContextAwareClient = new(Render)

func ProvideRender(renderService rendering.Service, extJwtAuth *ExtendedJWT) *Render {
	return &Render{renderService, extJwtAuth}
}

type Render struct {
	renderService rendering.Service
	extJwtAuth    *ExtendedJWT
}

func (c *Render) Name() string {
	return authn.ClientRender
}

func (c *Render) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	if key := getRenderKey(r); key != "" {
		renderUsr, ok := c.renderService.GetRenderUser(ctx, key)
		if !ok {
			return nil, errInvalidRenderKey.Errorf("found no render user for key: %s", key)
		}

		if renderUsr.UserID <= 0 {
			identityType := claims.TypeAnonymous
			if org.RoleType(renderUsr.OrgRole) == org.RoleAdmin {
				identityType = claims.TypeRenderService
			}
			return &authn.Identity{
				ID:              "0",
				UID:             "0",
				Type:            identityType,
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

	xGrafanaId := getRenderXGrafanaId(r)
	xAccessToken := getRenderXAccessToken(r)
	if c.extJwtAuth != nil && (xGrafanaId != "" || xAccessToken != "") {
		r.HTTPRequest.Header.Set(ExtJWTAuthorizationHeaderName, xGrafanaId)
		r.HTTPRequest.Header.Set(ExtJWTAuthenticationHeaderName, xAccessToken)

		r.SetMeta(MetaAuthenticatedByOverride, login.RenderModule)

		logging.FromContext(ctx).Info("[SERVER] RENDER AUTH WITH EXT JWT", "X-Grafana-Id", xGrafanaId, "X-Access-Token", xAccessToken)

		return c.extJwtAuth.Authenticate(ctx, r)
	}

	return nil, fmt.Errorf("no auth method available")
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
	return getCookieValueOrEmpty(r, renderCookieName)
}

func getRenderXGrafanaId(r *authn.Request) string {
	return getCookieValueOrEmpty(r, ExtJWTAuthorizationHeaderName)
}

func getRenderXAccessToken(r *authn.Request) string {
	return getCookieValueOrEmpty(r, ExtJWTAuthenticationHeaderName)
}

func getCookieValueOrEmpty(r *authn.Request, name string) string {
	cookie, err := r.HTTPRequest.Cookie(name)
	if err != nil {
		return ""
	}
	return cookie.Value
}
