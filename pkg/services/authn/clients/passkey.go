package clients

import (
	"context"
	"encoding/json"
	"strconv"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/passkey"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var errPasskeyBadRequest = errutil.BadRequest("passkey-auth.invalid", errutil.WithPublicMessage("bad login data"))

var _ authn.Client = new(Passkey)

func ProvidePasskey(cfg *setting.Cfg, features featuremgmt.FeatureToggles, service passkey.Service) *Passkey {
	return &Passkey{cfg: cfg, features: features, service: service}
}

// Passkey authenticates a verified WebAuthn assertion and turns it into a Grafana identity. It is a
// login-only client: it implements authn.Client but deliberately not authn.ContextAwareClient, so it
// is never tried during ordinary request authentication and is reached only via an explicit
// Login(ctx, authn.ClientPasskey, req) call from the passkey HTTP handler.
type Passkey struct {
	cfg      *setting.Cfg
	features featuremgmt.FeatureToggles
	service  passkey.Service
}

// loginFinishRequest is the body the browser posts to finish a login ceremony: the opaque sessionID
// from the begin step plus the raw PublicKeyCredential the authenticator produced. The client owns
// parsing this body so the assertion is read exactly once on its way to the verifier.
type loginFinishRequest struct {
	SessionID string          `json:"sessionId"`
	Response  json.RawMessage `json:"response"`
}

func (c *Passkey) Name() string {
	return authn.ClientPasskey
}

// IsEnabled gates on both the build-level feature toggle and the operator's config switch.
func (c *Passkey) IsEnabled() bool {
	return c.cfg.Passkey.Enabled && c.features.IsEnabledGlobally(featuremgmt.FlagGrafanaPasskeyAuthn)
}

func (c *Passkey) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	form := loginFinishRequest{}
	if err := web.Bind(r.HTTPRequest, &form); err != nil {
		return nil, errPasskeyBadRequest.Errorf("failed to parse request: %w", err)
	}

	// FinishLogin verifies the assertion and resolves the owner by the decoded user handle. It
	// returns passkey.ErrChallengeExpired or the uniform passkey.ErrLoginFailed (which does not
	// reveal whether a credential existed). We pass the error through unchanged so the handler can
	// still distinguish the expired case (410) from the rest with errors.Is.
	userID, err := c.service.FinishLogin(ctx, form.SessionID, form.Response)
	if err != nil {
		return nil, err
	}

	// FetchSyncedUser + SyncPermissions make the authn service run its post-authentication hooks,
	// which is what rejects a disabled user and loads the user's permissions. AuthenticatedBy stamps
	// the identity so the login is attributable to the passkey method in the audit log.
	return &authn.Identity{
		ID:              strconv.FormatInt(userID, 10),
		Type:            claims.TypeUser,
		OrgID:           r.OrgID,
		AuthenticatedBy: login.PasskeyAuthModule,
		ClientParams: authn.ClientParams{
			FetchSyncedUser: true,
			SyncPermissions: true,
		},
	}, nil
}
