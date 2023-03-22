package authproxy

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"hash/fnv"
	"net"
	"net/mail"
	"path"
	"reflect"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const (

	// CachePrefix is a prefix for the cache key
	CachePrefix = "auth-proxy-sync-ttl:%s"
)

// getLDAPConfig gets LDAP config
var getLDAPConfig = ldap.GetConfig

// isLDAPEnabled checks if LDAP is enabled
var isLDAPEnabled = func(cfg *setting.Cfg) bool {
	if cfg != nil {
		return cfg.LDAPAuthEnabled
	}

	return setting.LDAPAuthEnabled
}

// newLDAP creates multiple LDAP instance
var newLDAP = multildap.New

// supportedHeaders states the supported headers configuration fields
var supportedHeaderFields = []string{"Name", "Email", "Login", "Groups", "Role"}

// AuthProxy struct
type AuthProxy struct {
	cfg          *setting.Cfg
	remoteCache  *remotecache.RemoteCache
	loginService login.Service
	sqlStore     db.DB
	userService  user.Service

	logger log.Logger
}

func ProvideAuthProxy(cfg *setting.Cfg, remoteCache *remotecache.RemoteCache, loginService login.Service, userService user.Service, sqlStore db.DB) *AuthProxy {
	return &AuthProxy{
		cfg:          cfg,
		remoteCache:  remoteCache,
		loginService: loginService,
		sqlStore:     sqlStore,
		userService:  userService,
		logger:       log.New("auth.proxy"),
	}
}

// Error auth proxy specific error
type Error struct {
	Message      string
	DetailsError error
}

// newError returns an Error.
func newError(message string, err error) Error {
	return Error{
		Message:      message,
		DetailsError: err,
	}
}

// Error returns the error message.
func (err Error) Error() string {
	return err.Message
}

// IsEnabled checks if the auth proxy is enabled.
func (auth *AuthProxy) IsEnabled() bool {
	// Bail if the setting is not enabled
	return auth.cfg.AuthProxyEnabled
}

// HasHeader checks if we have specified header
func (auth *AuthProxy) HasHeader(reqCtx *contextmodel.ReqContext) bool {
	header := auth.getDecodedHeader(reqCtx, auth.cfg.AuthProxyHeaderName)
	return len(header) != 0
}

// IsAllowedIP returns whether provided IP is allowed.
func (auth *AuthProxy) IsAllowedIP(ip string) error {
	if len(strings.TrimSpace(auth.cfg.AuthProxyWhitelist)) == 0 {
		return nil
	}

	proxies := strings.Split(auth.cfg.AuthProxyWhitelist, ",")
	proxyObjs := make([]*net.IPNet, 0, len(proxies))
	for _, proxy := range proxies {
		result, err := coerceProxyAddress(proxy)
		if err != nil {
			return newError("could not get the network", err)
		}

		proxyObjs = append(proxyObjs, result)
	}

	sourceIP, _, err := net.SplitHostPort(ip)
	if err != nil {
		return newError("could not parse address", err)
	}
	sourceObj := net.ParseIP(sourceIP)

	for _, proxyObj := range proxyObjs {
		if proxyObj.Contains(sourceObj) {
			return nil
		}
	}

	return newError("proxy authentication required", fmt.Errorf(
		"request for user from %s is not from the authentication proxy",
		sourceIP,
	))
}

func HashCacheKey(key string) (string, error) {
	hasher := fnv.New128a()
	if _, err := hasher.Write([]byte(key)); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// getKey forms a key for the cache based on the headers received as part of the authentication flow.
// Our configuration supports multiple headers. The main header contains the email or username.
// And the additional ones that allow us to specify extra attributes: Name, Email, Role, or Groups.
func (auth *AuthProxy) getKey(reqCtx *contextmodel.ReqContext) (string, error) {
	header := auth.getDecodedHeader(reqCtx, auth.cfg.AuthProxyHeaderName)
	key := strings.TrimSpace(header) // start the key with the main header

	auth.headersIterator(reqCtx, func(_, header string) {
		key = strings.Join([]string{key, header}, "-") // compose the key with any additional headers
	})

	hashedKey, err := HashCacheKey(key)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(CachePrefix, hashedKey), nil
}

// Login logs in user ID by whatever means possible.
func (auth *AuthProxy) Login(reqCtx *contextmodel.ReqContext, ignoreCache bool) (int64, error) {
	if !ignoreCache {
		// Error here means absent cache - we don't need to handle that
		id, err := auth.getUserViaCache(reqCtx)
		if err == nil && id != 0 {
			return id, nil
		}
	}

	if isLDAPEnabled(auth.cfg) {
		id, err := auth.LoginViaLDAP(reqCtx)
		if err != nil {
			if errors.Is(err, ldap.ErrInvalidCredentials) {
				return 0, newError("proxy authentication required", ldap.ErrInvalidCredentials)
			}
			return 0, newError("failed to get the user", err)
		}

		return id, nil
	}

	id, err := auth.loginViaHeader(reqCtx)
	if err != nil {
		return 0, newError("failed to log in as user, specified in auth proxy header", err)
	}

	return id, nil
}

// getUserViaCache gets user ID from cache.
func (auth *AuthProxy) getUserViaCache(reqCtx *contextmodel.ReqContext) (int64, error) {
	cacheKey, err := auth.getKey(reqCtx)
	if err != nil {
		return 0, err
	}
	auth.logger.Debug("Getting user ID via auth cache", "cacheKey", cacheKey)
	userID, err := auth.remoteCache.Get(reqCtx.Req.Context(), cacheKey)
	if err != nil {
		auth.logger.Debug("Failed getting user ID via auth cache", "error", err)
		return 0, err
	}

	auth.logger.Debug("Successfully got user ID via auth cache", "id", userID)
	return userID.(int64), nil
}

// RemoveUserFromCache removes user from cache.
func (auth *AuthProxy) RemoveUserFromCache(reqCtx *contextmodel.ReqContext) error {
	cacheKey, err := auth.getKey(reqCtx)
	if err != nil {
		return err
	}
	auth.logger.Debug("Removing user from auth cache", "cacheKey", cacheKey)
	if err := auth.remoteCache.Delete(reqCtx.Req.Context(), cacheKey); err != nil {
		return err
	}

	auth.logger.Debug("Successfully removed user from auth cache", "cacheKey", cacheKey)
	return nil
}

// LoginViaLDAP logs in user via LDAP request
func (auth *AuthProxy) LoginViaLDAP(reqCtx *contextmodel.ReqContext) (int64, error) {
	config, err := getLDAPConfig(auth.cfg)
	if err != nil {
		return 0, newError("failed to get LDAP config", err)
	}

	header := auth.getDecodedHeader(reqCtx, auth.cfg.AuthProxyHeaderName)
	mldap := newLDAP(config.Servers)
	extUser, _, err := mldap.User(header)
	if err != nil {
		return 0, err
	}

	// Have to sync grafana and LDAP user during log in
	upsert := &login.UpsertUserCommand{
		ReqContext:    reqCtx,
		SignupAllowed: auth.cfg.LDAPAllowSignup,
		ExternalUser:  extUser,
		UserLookupParams: login.UserLookupParams{
			Login:  &extUser.Login,
			Email:  &extUser.Email,
			UserID: nil,
		},
	}
	if err := auth.loginService.UpsertUser(reqCtx.Req.Context(), upsert); err != nil {
		return 0, err
	}

	return upsert.Result.ID, nil
}

// loginViaHeader logs in user from the header only
func (auth *AuthProxy) loginViaHeader(reqCtx *contextmodel.ReqContext) (int64, error) {
	header := auth.getDecodedHeader(reqCtx, auth.cfg.AuthProxyHeaderName)
	extUser := &login.ExternalUserInfo{
		AuthModule: login.AuthProxyAuthModule,
		AuthId:     header,
	}

	switch auth.cfg.AuthProxyHeaderProperty {
	case "username":
		extUser.Login = header

		emailAddr, emailErr := mail.ParseAddress(header) // only set Email if it can be parsed as an email address
		if emailErr == nil {
			extUser.Email = emailAddr.Address
		}
	case "email":
		extUser.Email = header
		extUser.Login = header
	default:
		return 0, fmt.Errorf("auth proxy header property invalid")
	}

	auth.headersIterator(reqCtx, func(field string, header string) {
		switch field {
		case "Groups":
			extUser.Groups = util.SplitString(header)
		case "Role":
			// If Role header is specified, we update the user role of the default org
			if header != "" {
				rt := org.RoleType(header)
				if rt.IsValid() {
					extUser.OrgRoles = map[int64]org.RoleType{}
					orgID := int64(1)
					if setting.AutoAssignOrg && setting.AutoAssignOrgId > 0 {
						orgID = int64(setting.AutoAssignOrgId)
					}
					extUser.OrgRoles[orgID] = rt
				}
			}
		default:
			reflect.ValueOf(extUser).Elem().FieldByName(field).SetString(header)
		}
	})

	upsert := &login.UpsertUserCommand{
		ReqContext:    reqCtx,
		SignupAllowed: auth.cfg.AuthProxyAutoSignUp,
		ExternalUser:  extUser,
		UserLookupParams: login.UserLookupParams{
			UserID: nil,
			Login:  &extUser.Login,
			Email:  &extUser.Email,
		},
	}

	err := auth.loginService.UpsertUser(reqCtx.Req.Context(), upsert)
	if err != nil {
		return 0, err
	}

	return upsert.Result.ID, nil
}

// getDecodedHeader gets decoded value of a header with given headerName
func (auth *AuthProxy) getDecodedHeader(reqCtx *contextmodel.ReqContext, headerName string) string {
	headerValue := reqCtx.Req.Header.Get(headerName)

	if auth.cfg.AuthProxyHeadersEncoded {
		headerValue = util.DecodeQuotedPrintable(headerValue)
	}

	return headerValue
}

// headersIterator iterates over all non-empty supported additional headers
func (auth *AuthProxy) headersIterator(reqCtx *contextmodel.ReqContext, fn func(field string, header string)) {
	for _, field := range supportedHeaderFields {
		h := auth.cfg.AuthProxyHeaders[field]
		if h == "" {
			continue
		}

		if value := auth.getDecodedHeader(reqCtx, h); value != "" {
			fn(field, strings.TrimSpace(value))
		}
	}
}

// GetSignedInUser gets full signed in user info.
func (auth *AuthProxy) GetSignedInUser(userID int64, orgID int64) (*user.SignedInUser, error) {
	return auth.userService.GetSignedInUser(context.Background(), &user.GetSignedInUserQuery{
		OrgID:  orgID,
		UserID: userID,
	})
}

// Remember user in cache
func (auth *AuthProxy) Remember(reqCtx *contextmodel.ReqContext, id int64) error {
	key, err := auth.getKey(reqCtx)
	if err != nil {
		return err
	}

	// Check if user already in cache
	userID, err := auth.remoteCache.Get(reqCtx.Req.Context(), key)
	if err == nil && userID != nil {
		return nil
	}

	expiration := time.Duration(auth.cfg.AuthProxySyncTTL) * time.Minute

	if err := auth.remoteCache.Set(reqCtx.Req.Context(), key, id, expiration); err != nil {
		return err
	}

	return nil
}

// coerceProxyAddress gets network of the presented CIDR notation
func coerceProxyAddress(proxyAddr string) (*net.IPNet, error) {
	proxyAddr = strings.TrimSpace(proxyAddr)
	if !strings.Contains(proxyAddr, "/") {
		proxyAddr = path.Join(proxyAddr, "32")
	}

	_, network, err := net.ParseCIDR(proxyAddr)
	if err != nil {
		return nil, fmt.Errorf("could not parse the network: %w", err)
	}
	return network, nil
}
