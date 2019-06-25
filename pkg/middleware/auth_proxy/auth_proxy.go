package authproxy

import (
	"fmt"
	"net"
	"net/mail"
	"reflect"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/setting"
)

const (

	// CachePrefix is a prefix for the cache key
	CachePrefix = "auth-proxy-sync-ttl:%s"
)

// getLDAPConfig gets LDAP config
var getLDAPConfig = ldap.GetConfig

// isLDAPEnabled checks if LDAP is enabled
var isLDAPEnabled = ldap.IsEnabled

// newLDAP creates multiple LDAP instance
var newLDAP = multildap.New

// AuthProxy struct
type AuthProxy struct {
	store  *remotecache.RemoteCache
	ctx    *models.ReqContext
	orgID  int64
	header string

	enabled             bool
	LDAPAllowSignup     bool
	AuthProxyAutoSignUp bool
	whitelistIP         string
	headerType          string
	headers             map[string]string
	cacheTTL            int
}

// Error auth proxy specific error
type Error struct {
	Message      string
	DetailsError error
}

// newError creates the Error
func newError(message string, err error) *Error {
	return &Error{
		Message:      message,
		DetailsError: err,
	}
}

// Error returns a Error error string
func (err *Error) Error() string {
	return err.Message
}

// Options for the AuthProxy
type Options struct {
	Store *remotecache.RemoteCache
	Ctx   *models.ReqContext
	OrgID int64
}

// New instance of the AuthProxy
func New(options *Options) *AuthProxy {
	header := options.Ctx.Req.Header.Get(setting.AuthProxyHeaderName)

	return &AuthProxy{
		store:  options.Store,
		ctx:    options.Ctx,
		orgID:  options.OrgID,
		header: header,

		enabled:             setting.AuthProxyEnabled,
		headerType:          setting.AuthProxyHeaderProperty,
		headers:             setting.AuthProxyHeaders,
		whitelistIP:         setting.AuthProxyWhitelist,
		cacheTTL:            setting.AuthProxyLDAPSyncTtl,
		LDAPAllowSignup:     setting.LDAPAllowSignup,
		AuthProxyAutoSignUp: setting.AuthProxyAutoSignUp,
	}
}

// IsEnabled checks if the proxy auth is enabled
func (auth *AuthProxy) IsEnabled() bool {

	// Bail if the setting is not enabled
	return auth.enabled
}

// HasHeader checks if the we have specified header
func (auth *AuthProxy) HasHeader() bool {
	return len(auth.header) != 0
}

// IsAllowedIP compares presented IP with the whitelist one
func (auth *AuthProxy) IsAllowedIP() (bool, *Error) {
	ip := auth.ctx.Req.RemoteAddr

	if len(strings.TrimSpace(auth.whitelistIP)) == 0 {
		return true, nil
	}

	proxies := strings.Split(auth.whitelistIP, ",")
	var proxyObjs []*net.IPNet
	for _, proxy := range proxies {
		result, err := coerceProxyAddress(proxy)
		if err != nil {
			return false, newError("Could not get the network", err)
		}

		proxyObjs = append(proxyObjs, result)
	}

	sourceIP, _, _ := net.SplitHostPort(ip)
	sourceObj := net.ParseIP(sourceIP)

	for _, proxyObj := range proxyObjs {
		if proxyObj.Contains(sourceObj) {
			return true, nil
		}
	}

	err := fmt.Errorf(
		"Request for user (%s) from %s is not from the authentication proxy", auth.header,
		sourceIP,
	)

	return false, newError("Proxy authentication required", err)
}

// getKey forms a key for the cache
func (auth *AuthProxy) getKey() string {
	return fmt.Sprintf(CachePrefix, auth.header)
}

// Login logs in user id with whatever means possible
func (auth *AuthProxy) Login() (int64, *Error) {

	id, _ := auth.GetUserViaCache()
	if id != 0 {
		// Error here means absent cache - we don't need to handle that
		return id, nil
	}

	if isLDAPEnabled() {
		id, err := auth.LoginViaLDAP()

		if err == ldap.ErrInvalidCredentials {
			return 0, newError(
				"Proxy authentication required",
				ldap.ErrInvalidCredentials,
			)
		}

		if err != nil {
			return 0, newError("Failed to get the user", err)
		}

		return id, nil
	}

	id, err := auth.LoginViaHeader()
	if err != nil {
		return 0, newError(
			"Failed to log in as user, specified in auth proxy header",
			err,
		)
	}

	return id, nil
}

// GetUserViaCache gets user id from cache
func (auth *AuthProxy) GetUserViaCache() (int64, error) {
	var (
		cacheKey    = auth.getKey()
		userID, err = auth.store.Get(cacheKey)
	)

	if err != nil {
		return 0, err
	}

	return userID.(int64), nil
}

// LoginViaLDAP logs in user via LDAP request
func (auth *AuthProxy) LoginViaLDAP() (int64, *Error) {
	config, err := getLDAPConfig()
	if err != nil {
		return 0, newError("Failed to get LDAP config", nil)
	}

	extUser, err := newLDAP(config.Servers).User(auth.header)
	if err != nil {
		return 0, newError(err.Error(), nil)
	}

	// Have to sync grafana and LDAP user during log in
	upsert := &models.UpsertUserCommand{
		ReqContext:    auth.ctx,
		SignupAllowed: auth.LDAPAllowSignup,
		ExternalUser:  extUser,
	}
	err = bus.Dispatch(upsert)
	if err != nil {
		return 0, newError(err.Error(), nil)
	}

	return upsert.Result.Id, nil
}

// LoginViaHeader logs in user from the header only
// TODO: refactor - cyclomatic complexity should be much lower
func (auth *AuthProxy) LoginViaHeader() (int64, error) {
	extUser := &models.ExternalUserInfo{
		AuthModule: "authproxy",
		AuthId:     auth.header,
	}

	if auth.headerType == "username" {
		extUser.Login = auth.header

		// only set Email if it can be parsed as an email address
		emailAddr, emailErr := mail.ParseAddress(auth.header)
		if emailErr == nil {
			extUser.Email = emailAddr.Address
		}
	} else if auth.headerType == "email" {
		extUser.Email = auth.header
		extUser.Login = auth.header
	} else {
		return 0, newError("Auth proxy header property invalid", nil)
	}

	for _, field := range []string{"Name", "Email", "Login"} {
		if auth.headers[field] == "" {
			continue
		}

		if val := auth.ctx.Req.Header.Get(auth.headers[field]); val != "" {
			reflect.ValueOf(extUser).Elem().FieldByName(field).SetString(val)
		}
	}

	upsert := &models.UpsertUserCommand{
		ReqContext:    auth.ctx,
		SignupAllowed: true,
		ExternalUser:  extUser,
	}
	err := bus.Dispatch(upsert)
	if err != nil {
		return 0, err
	}

	return upsert.Result.Id, nil
}

// GetSignedUser get full signed user info
func (auth *AuthProxy) GetSignedUser(userID int64) (*models.SignedInUser, *Error) {
	query := &models.GetSignedInUserQuery{
		OrgId:  auth.orgID,
		UserId: userID,
	}

	if err := bus.Dispatch(query); err != nil {
		return nil, newError(err.Error(), nil)
	}

	return query.Result, nil
}

// Remember user in cache
func (auth *AuthProxy) Remember(id int64) *Error {
	key := auth.getKey()

	// Check if user already in cache
	userID, _ := auth.store.Get(key)
	if userID != nil {
		return nil
	}

	expiration := time.Duration(auth.cacheTTL) * time.Minute

	err := auth.store.Set(key, id, expiration)
	if err != nil {
		return newError(err.Error(), nil)
	}

	return nil
}

// coerceProxyAddress gets network of the presented CIDR notation
func coerceProxyAddress(proxyAddr string) (*net.IPNet, error) {
	proxyAddr = strings.TrimSpace(proxyAddr)
	if !strings.Contains(proxyAddr, "/") {
		proxyAddr = strings.Join([]string{proxyAddr, "32"}, "/")
	}

	_, network, err := net.ParseCIDR(proxyAddr)
	return network, err
}
