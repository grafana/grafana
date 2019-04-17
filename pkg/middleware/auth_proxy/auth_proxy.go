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
	"github.com/grafana/grafana/pkg/login"
	models "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

const (

	// CachePrefix is a prefix for the cache key
	CachePrefix = "auth-proxy-sync-ttl:%s"
)

// AuthProxy struct
type AuthProxy struct {
	store  *remotecache.RemoteCache
	ctx    *models.ReqContext
	orgID  int64
	header string

	LDAP func(server *login.LdapServerConf) login.ILdapAuther

	enabled     bool
	whitelistIP string
	headerType  string
	headers     map[string]string
	cacheTTL    int
	ldapEnabled bool
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
	return fmt.Sprintf("%s", err.Message)
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

		LDAP: login.NewLdapAuthenticator,

		enabled:     setting.AuthProxyEnabled,
		headerType:  setting.AuthProxyHeaderProperty,
		headers:     setting.AuthProxyHeaders,
		whitelistIP: setting.AuthProxyWhitelist,
		cacheTTL:    setting.AuthProxyLdapSyncTtl,
		ldapEnabled: setting.LdapEnabled,
	}
}

// IsEnabled checks if the proxy auth is enabled
func (auth *AuthProxy) IsEnabled() bool {

	// Bail if the setting is not enabled
	if auth.enabled == false {
		return false
	}

	return true
}

// HasHeader checks if the we have specified header
func (auth *AuthProxy) HasHeader() bool {
	if len(auth.header) == 0 {
		return false
	}

	return true
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

// InCache checks if we have user in cache
func (auth *AuthProxy) InCache() bool {
	userID, _ := auth.GetUserIDViaCache()

	if userID == 0 {
		return false
	}

	return true
}

// getKey forms a key for the cache
func (auth *AuthProxy) getKey() string {
	return fmt.Sprintf(CachePrefix, auth.header)
}

// GetUserID gets user id with whatever means possible
func (auth *AuthProxy) GetUserID() (int64, *Error) {
	if auth.InCache() {

		// Error here means absent cache - we don't need to handle that
		id, _ := auth.GetUserIDViaCache()

		return id, nil
	}

	if auth.ldapEnabled {
		id, err := auth.GetUserIDViaLDAP()

		if err == login.ErrInvalidCredentials {
			return 0, newError("Proxy authentication required", login.ErrInvalidCredentials)
		}

		if err != nil {
			return 0, newError("Failed to sync user", err)
		}

		return id, nil
	}

	id, err := auth.GetUserIDViaHeader()
	if err != nil {
		return 0, newError("Failed to login as user specified in auth proxy header", err)
	}

	return id, nil
}

// GetUserIDViaCache gets the user from cache
func (auth *AuthProxy) GetUserIDViaCache() (int64, error) {
	var (
		cacheKey    = auth.getKey()
		userID, err = auth.store.Get(cacheKey)
	)

	if err != nil {
		return 0, err
	}

	return userID.(int64), nil
}

// GetUserIDViaLDAP gets user via LDAP request
func (auth *AuthProxy) GetUserIDViaLDAP() (int64, *Error) {
	query := &models.LoginUserQuery{
		ReqContext: auth.ctx,
		Username:   auth.header,
	}

	ldapCfg := login.LdapCfg
	if len(ldapCfg.Servers) < 1 {
		return 0, newError("No LDAP servers available", nil)
	}

	for _, server := range ldapCfg.Servers {
		author := auth.LDAP(server)
		if err := author.SyncUser(query); err != nil {
			return 0, newError(err.Error(), nil)
		}
	}

	return query.User.Id, nil
}

// GetUserIDViaHeader gets user from the header only
func (auth *AuthProxy) GetUserIDViaHeader() (int64, error) {
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

	// add/update user in grafana
	cmd := &models.UpsertUserCommand{
		ReqContext:    auth.ctx,
		ExternalUser:  extUser,
		SignupAllowed: setting.AuthProxyAutoSignUp,
	}
	err := bus.Dispatch(cmd)
	if err != nil {
		return 0, err
	}

	return cmd.Result.Id, nil
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
func (auth *AuthProxy) Remember() *Error {

	// Make sure we do not rewrite the expiration time
	if auth.InCache() {
		return nil
	}

	var (
		key        = auth.getKey()
		value, _   = auth.GetUserIDViaCache()
		expiration = time.Duration(-auth.cacheTTL) * time.Minute

		err = auth.store.Set(key, value, expiration)
	)

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
