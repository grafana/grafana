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

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/multildap"
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
		return cfg.LDAPEnabled
	}

	return setting.LDAPEnabled
}

// newLDAP creates multiple LDAP instance
var newLDAP = multildap.New

// supportedHeaders states the supported headers configuration fields
var supportedHeaderFields = []string{"Name", "Email", "Login", "Groups", "Role"}

// AuthProxy struct
type AuthProxy struct {
	cfg         *setting.Cfg
	remoteCache *remotecache.RemoteCache
	ctx         *models.ReqContext
	orgID       int64
	header      string
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

// Options for the AuthProxy
type Options struct {
	RemoteCache *remotecache.RemoteCache
	Ctx         *models.ReqContext
	OrgID       int64
}

// New instance of the AuthProxy.
func New(cfg *setting.Cfg, options *Options) *AuthProxy {
	header := options.Ctx.Req.Header.Get(cfg.AuthProxyHeaderName)
	return &AuthProxy{
		remoteCache: options.RemoteCache,
		cfg:         cfg,
		ctx:         options.Ctx,
		orgID:       options.OrgID,
		header:      header,
	}
}

// IsEnabled checks if the auth proxy is enabled.
func (auth *AuthProxy) IsEnabled() bool {
	// Bail if the setting is not enabled
	return auth.cfg.AuthProxyEnabled
}

// HasHeader checks if the we have specified header
func (auth *AuthProxy) HasHeader() bool {
	return len(auth.header) != 0
}

// IsAllowedIP returns whether provided IP is allowed.
func (auth *AuthProxy) IsAllowedIP() error {
	ip := auth.ctx.Req.RemoteAddr

	if len(strings.TrimSpace(auth.cfg.AuthProxyWhitelist)) == 0 {
		return nil
	}

	proxies := strings.Split(auth.cfg.AuthProxyWhitelist, ",")
	var proxyObjs []*net.IPNet
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
		"request for user (%s) from %s is not from the authentication proxy", auth.header,
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
func (auth *AuthProxy) getKey() (string, error) {
	key := strings.TrimSpace(auth.header) // start the key with the main header

	auth.headersIterator(func(_, header string) {
		key = strings.Join([]string{key, header}, "-") // compose the key with any additional headers
	})

	hashedKey, err := HashCacheKey(key)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(CachePrefix, hashedKey), nil
}

// Login logs in user ID by whatever means possible.
func (auth *AuthProxy) Login(logger log.Logger, ignoreCache bool) (int64, error) {
	if !ignoreCache {
		// Error here means absent cache - we don't need to handle that
		id, err := auth.GetUserViaCache(logger)
		if err == nil && id != 0 {
			return id, nil
		}
	}

	if isLDAPEnabled(auth.cfg) {
		id, err := auth.LoginViaLDAP()
		if err != nil {
			if errors.Is(err, ldap.ErrInvalidCredentials) {
				return 0, newError("proxy authentication required", ldap.ErrInvalidCredentials)
			}
			return 0, newError("failed to get the user", err)
		}

		return id, nil
	}

	id, err := auth.LoginViaHeader()
	if err != nil {
		return 0, newError("failed to log in as user, specified in auth proxy header", err)
	}

	return id, nil
}

// GetUserViaCache gets user ID from cache.
func (auth *AuthProxy) GetUserViaCache(logger log.Logger) (int64, error) {
	cacheKey, err := auth.getKey()
	if err != nil {
		return 0, err
	}
	logger.Debug("Getting user ID via auth cache", "cacheKey", cacheKey)
	userID, err := auth.remoteCache.Get(cacheKey)
	if err != nil {
		logger.Debug("Failed getting user ID via auth cache", "error", err)
		return 0, err
	}

	logger.Debug("Successfully got user ID via auth cache", "id", userID)
	return userID.(int64), nil
}

// RemoveUserFromCache removes user from cache.
func (auth *AuthProxy) RemoveUserFromCache(logger log.Logger) error {
	cacheKey, err := auth.getKey()
	if err != nil {
		return err
	}
	logger.Debug("Removing user from auth cache", "cacheKey", cacheKey)
	if err := auth.remoteCache.Delete(cacheKey); err != nil {
		return err
	}

	logger.Debug("Successfully removed user from auth cache", "cacheKey", cacheKey)
	return nil
}

// LoginViaLDAP logs in user via LDAP request
func (auth *AuthProxy) LoginViaLDAP() (int64, error) {
	config, err := getLDAPConfig(auth.cfg)
	if err != nil {
		return 0, newError("failed to get LDAP config", err)
	}

	mldap := newLDAP(config.Servers)
	extUser, _, err := mldap.User(auth.header)
	if err != nil {
		return 0, err
	}

	// Have to sync grafana and LDAP user during log in
	upsert := &models.UpsertUserCommand{
		ReqContext:    auth.ctx,
		SignupAllowed: auth.cfg.LDAPAllowSignup,
		ExternalUser:  extUser,
	}
	if err := bus.Dispatch(upsert); err != nil {
		return 0, err
	}

	return upsert.Result.Id, nil
}

// LoginViaHeader logs in user from the header only
func (auth *AuthProxy) LoginViaHeader() (int64, error) {
	extUser := &models.ExternalUserInfo{
		AuthModule: "authproxy",
		AuthId:     auth.header,
	}

	switch auth.cfg.AuthProxyHeaderProperty {
	case "username":
		extUser.Login = auth.header

		emailAddr, emailErr := mail.ParseAddress(auth.header) // only set Email if it can be parsed as an email address
		if emailErr == nil {
			extUser.Email = emailAddr.Address
		}
	case "email":
		extUser.Email = auth.header
		extUser.Login = auth.header
	default:
		return 0, fmt.Errorf("auth proxy header property invalid")
	}

	auth.headersIterator(func(field string, header string) {
		switch field {
		case "Groups":
			extUser.Groups = util.SplitString(header)
		case "Role":
			// If Role header is specified, we update the user role of the default org
			if header != "" {
				rt := models.RoleType(header)
				if rt.IsValid() {
					extUser.OrgRoles = map[int64]models.RoleType{}
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

	upsert := &models.UpsertUserCommand{
		ReqContext:    auth.ctx,
		SignupAllowed: auth.cfg.AuthProxyAutoSignUp,
		ExternalUser:  extUser,
	}

	err := bus.Dispatch(upsert)
	if err != nil {
		return 0, err
	}

	return upsert.Result.Id, nil
}

// headersIterator iterates over all non-empty supported additional headers
func (auth *AuthProxy) headersIterator(fn func(field string, header string)) {
	for _, field := range supportedHeaderFields {
		h := auth.cfg.AuthProxyHeaders[field]
		if h == "" {
			continue
		}

		if value := auth.ctx.Req.Header.Get(h); value != "" {
			fn(field, strings.TrimSpace(value))
		}
	}
}

// GetSignedUser gets full signed in user info.
func (auth *AuthProxy) GetSignedInUser(userID int64) (*models.SignedInUser, error) {
	query := &models.GetSignedInUserQuery{
		OrgId:  auth.orgID,
		UserId: userID,
	}

	if err := bus.DispatchCtx(context.Background(), query); err != nil {
		return nil, err
	}

	return query.Result, nil
}

// Remember user in cache
func (auth *AuthProxy) Remember(id int64) error {
	key, err := auth.getKey()
	if err != nil {
		return err
	}

	// Check if user already in cache
	userID, err := auth.remoteCache.Get(key)
	if err == nil && userID != nil {
		return nil
	}

	expiration := time.Duration(auth.cfg.AuthProxySyncTTL) * time.Minute

	if err := auth.remoteCache.Set(key, id, expiration); err != nil {
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
