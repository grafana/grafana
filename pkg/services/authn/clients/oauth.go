package clients

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util/errutil"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	hostedDomainParamName        = "hd"
	codeVerifierParamName        = "code_verifier"
	codeChallengeParamName       = "code_challenge"
	codeChallengeMethodParamName = "code_challenge_method"
	codeChallengeMethod          = "S256"

	stateQueryName  = "state"
	stateCookieName = "oauth_state"
	pkceCookieName  = "oauth_code_verifier"
)

var (
	errMissingOAuthState   = errutil.NewBase(errutil.StatusBadRequest, "auth.oauth.state.missing", errutil.WithPublicMessage("Missing saved oauth state"))
	errInvalidOAuthState   = errutil.NewBase(errutil.StatusUnauthorized, "auth.oauth.state.invalid", errutil.WithPublicMessage("Provided state does not match stored state"))
	errMissingAttribute    = errutil.NewBase(errutil.StatusUnauthorized, "auth.oauth.attribute.missing")
	errAttributeNotAllowed = errutil.NewBase(errutil.StatusUnauthorized, "auth.oauth.attribute.not-allowed")
)

var _ authn.RedirectClient = new(OAuth)

func ProvideOAuthClient(
	name string, cfg *setting.Cfg, oauthCfg *social.OAuthInfo,
	connector social.SocialConnector, httpClient *http.Client,
) *OAuth {
	return &OAuth{
		name, fmt.Sprintf("oauth_%s", strings.TrimPrefix("auth.client.", name)),
		log.New(name), cfg, oauthCfg, connector, httpClient,
	}
}

type OAuth struct {
	name       string
	moduleName string
	log        log.Logger
	cfg        *setting.Cfg
	oauthCfg   *social.OAuthInfo
	connector  social.SocialConnector
	httpClient *http.Client
}

func (c *OAuth) Name() string {
	return c.name
}

func (c *OAuth) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	// get hashed state stored in cookie
	stateCookie, err := r.HTTPRequest.Cookie(stateCookieName)
	if err != nil {
		return nil, errMissingOAuthState.Errorf("missing state cookie")
	}

	if stateCookie.Value == "" {
		return nil, errMissingOAuthState.Errorf("missing state in state cookie")
	}

	// get state returned by the idp and hash it
	stateQuery := hashOAuthState(r.HTTPRequest.URL.Query().Get(stateQueryName), c.cfg.SecretKey, c.oauthCfg.ClientSecret)
	// compare the state returned by idp against the one we stored in cookie
	if stateQuery != stateCookie.Value {
		return nil, errInvalidOAuthState.Errorf("provided state did not match stored state")
	}

	var opts []oauth2.AuthCodeOption
	if c.oauthCfg.UsePKCE {
		pkceCookie, err := r.HTTPRequest.Cookie(pkceCookieName)
		if err != nil {
			return nil, err
		}
		opts = append(opts, oauth2.SetAuthURLParam(codeVerifierParamName, pkceCookie.Value))
	}

	clientCtx := context.WithValue(ctx, oauth2.HTTPClient, c.httpClient)
	// exchange auth code to a valid token
	token, err := c.connector.Exchange(clientCtx, r.HTTPRequest.URL.Query().Get("code"), opts...)
	if err != nil {
		return nil, err
	}
	token.TokenType = "Bearer"

	userInfo, err := c.connector.UserInfo(c.connector.Client(clientCtx, token), token)
	if err != nil {
		return nil, err
	}

	if userInfo.Email == "" {
		return nil, errMissingAttribute.Errorf("required attribute email was not provided")
	}

	if !c.connector.IsEmailAllowed(userInfo.Email) {
		return nil, errAttributeNotAllowed.Errorf("provided email is not allowed")
	}

	return &authn.Identity{
		Login:          userInfo.Login,
		Name:           userInfo.Name,
		Email:          userInfo.Email,
		IsGrafanaAdmin: userInfo.IsGrafanaAdmin,
		AuthModule:     c.moduleName,
		AuthID:         userInfo.Id,
		Groups:         userInfo.Groups,
		OAuthToken:     token,
		OrgRoles:       getOauthOrgRole(userInfo, c.cfg),
		ClientParams: authn.ClientParams{
			SyncUser:            true,
			SyncTeamMembers:     true,
			EnableDisabledUsers: true,
			AllowSignUp:         c.connector.IsSignupAllowed(),
			LookUpParams:        models.UserLookupParams{Email: &userInfo.Email},
		},
	}, nil
}

func (c *OAuth) RedirectURL(ctx context.Context, r *authn.Request) (*authn.Redirect, error) {
	var opts []oauth2.AuthCodeOption

	if c.oauthCfg.HostedDomain != "" {
		opts = append(opts, oauth2.SetAuthURLParam(hostedDomainParamName, c.oauthCfg.HostedDomain))
	}

	var plainPKCE string
	if c.oauthCfg.UsePKCE {
		pkce, hashedPKCE, err := genPKCECode()
		if err != nil {
			return nil, err
		}

		plainPKCE = pkce
		opts = append(opts,
			oauth2.SetAuthURLParam(codeChallengeParamName, hashedPKCE),
			oauth2.SetAuthURLParam(codeChallengeMethodParamName, codeChallengeMethod),
		)
	}

	state, hashedSate, err := genOAuthState(c.cfg.SecretKey, c.oauthCfg.ClientSecret)
	if err != nil {
		return nil, err
	}

	redirect := &authn.Redirect{}
	redirect.PKCE = plainPKCE
	redirect.State = hashedSate
	redirect.URL = c.connector.AuthCodeURL(state, opts...)
	return redirect, nil
}

func (c *OAuth) Test(ctx context.Context, r *authn.Request) bool {
	return true
}

// genPKCECode returns a random URL-friendly string and it's base64 URL encoded SHA256 digest.
func genPKCECode() (string, string, error) {
	// IETF RFC 7636 specifies that the code verifier should be 43-128
	// characters from a set of unreserved URI characters which is
	// almost the same as the set of characters in base64url.
	// https://datatracker.ietf.org/doc/html/rfc7636#section-4.1
	//
	// It doesn't hurt to generate a few more bytes here, we generate
	// 96 bytes which we then encode using base64url to make sure
	// they're within the set of unreserved characters.
	//
	// 96 is chosen because 96*8/6 = 128, which means that we'll have
	// 128 characters after it has been base64 encoded.
	raw := make([]byte, 96)
	_, err := rand.Read(raw)
	if err != nil {
		return "", "", err
	}
	ascii := make([]byte, 128)
	base64.RawURLEncoding.Encode(ascii, raw)

	shasum := sha256.Sum256(ascii)
	pkce := base64.RawURLEncoding.EncodeToString(shasum[:])
	return string(ascii), pkce, nil
}

func genOAuthState(secret, seed string) (string, string, error) {
	rnd := make([]byte, 32)
	if _, err := rand.Read(rnd); err != nil {
		return "", "", err
	}
	state := base64.URLEncoding.EncodeToString(rnd)
	return state, hashOAuthState(state, secret, seed), nil
}

func hashOAuthState(state, secret, seed string) string {
	hashBytes := sha256.Sum256([]byte(state + secret + seed))
	return hex.EncodeToString(hashBytes[:])
}

func getOauthOrgRole(userInfo *social.BasicUserInfo, cfg *setting.Cfg) map[int64]org.RoleType {
	orgRoles := make(map[int64]org.RoleType, 0)
	if cfg.OAuthSkipOrgRoleUpdateSync {
		return orgRoles
	}

	if userInfo.Role == "" || !userInfo.Role.IsValid() {
		return orgRoles
	}

	orgID := int64(1)
	if cfg.AutoAssignOrg && cfg.AutoAssignOrgId > 0 {
		orgID = int64(cfg.AutoAssignOrgId)
	}

	orgRoles[orgID] = userInfo.Role
	return orgRoles
}
