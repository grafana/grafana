package middleware

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
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

const (

	// cachePrefix is a prefix for the cache key
	cachePrefix = "auth-proxy-sync-ttl:%s"
)

func initContextWithAuthProxy(store *remotecache.RemoteCache, ctx *m.ReqContext, orgID int64) bool {
	if !setting.AuthProxyEnabled {
		return false
	}

	proxyHeaderValue := ctx.Req.Header.Get(setting.AuthProxyHeaderName)
	if len(proxyHeaderValue) == 0 {
		return false
	}

	// if auth proxy ip(s) defined, check if request comes from one of those
	if err := checkAuthenticationProxy(ctx.Req.RemoteAddr, proxyHeaderValue); err != nil {
		ctx.Handle(407, "Proxy authentication required", err)
		return true
	}

	query := &m.GetSignedInUserQuery{OrgId: orgID}
	cacheKey := fmt.Sprintf(cachePrefix, proxyHeaderValue)
	userID, err := store.Get(cacheKey)
	inCache := err == nil

	// load the user if we have them
	if inCache {
		query.UserId = userID.(int64)

		// if we're using ldap, pass authproxy login name to ldap user sync
	} else if setting.LdapEnabled {
		syncQuery := &m.LoginUserQuery{
			ReqContext: ctx,
			Username:   proxyHeaderValue,
		}

		if err := syncGrafanaUserWithLdapUser(syncQuery); err != nil {
			if err == login.ErrInvalidCredentials {
				ctx.Handle(500, "Unable to authenticate user", err)
				return false
			}
		}

		if syncQuery.User == nil {
			ctx.Handle(500, "Failed to sync user", nil)
			return false
		}

		query.UserId = syncQuery.User.Id
		// no ldap, just use the info we have
	} else {
		extUser := &m.ExternalUserInfo{
			AuthModule: "authproxy",
			AuthId:     proxyHeaderValue,
		}

		if setting.AuthProxyHeaderProperty == "username" {
			extUser.Login = proxyHeaderValue

			// only set Email if it can be parsed as an email address
			emailAddr, emailErr := mail.ParseAddress(proxyHeaderValue)
			if emailErr == nil {
				extUser.Email = emailAddr.Address
			}
		} else if setting.AuthProxyHeaderProperty == "email" {
			extUser.Email = proxyHeaderValue
			extUser.Login = proxyHeaderValue
		} else {
			ctx.Handle(500, "Auth proxy header property invalid", nil)
			return true
		}

		for _, field := range []string{"Name", "Email", "Login"} {
			if setting.AuthProxyHeaders[field] == "" {
				continue
			}

			if val := ctx.Req.Header.Get(setting.AuthProxyHeaders[field]); val != "" {
				reflect.ValueOf(extUser).Elem().FieldByName(field).SetString(val)
			}
		}

		// add/update user in grafana
		cmd := &m.UpsertUserCommand{
			ReqContext:    ctx,
			ExternalUser:  extUser,
			SignupAllowed: setting.AuthProxyAutoSignUp,
		}
		err := bus.Dispatch(cmd)
		if err != nil {
			ctx.Handle(500, "Failed to login as user specified in auth proxy header", err)
			return true
		}

		query.UserId = cmd.Result.Id
	}

	if err := bus.Dispatch(query); err != nil {
		ctx.Handle(500, "Failed to find user", err)
		return true
	}
	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true

	expiration := time.Duration(-setting.AuthProxyLdapSyncTtl) * time.Minute
	value := query.UserId

	// This <if> is here to make sure we do not
	// rewrite the expiration all the time
	if inCache == false {
		if err = store.Set(cacheKey, value, expiration); err != nil {
			ctx.Handle(500, "Couldn't write a user in cache key", err)
			return true
		}
	}

	return true
}

var syncGrafanaUserWithLdapUser = func(query *m.LoginUserQuery) error {
	ldapCfg := login.LdapCfg
	if len(ldapCfg.Servers) < 1 {
		return fmt.Errorf("No LDAP servers available")
	}

	for _, server := range ldapCfg.Servers {
		author := login.NewLdapAuthenticator(server)
		if err := author.SyncUser(query); err != nil {
			return err
		}
	}

	return nil
}

func checkAuthenticationProxy(remoteAddr string, proxyHeaderValue string) error {
	if len(strings.TrimSpace(setting.AuthProxyWhitelist)) == 0 {
		return nil
	}

	proxies := strings.Split(setting.AuthProxyWhitelist, ",")
	var proxyObjs []*net.IPNet
	for _, proxy := range proxies {
		proxyObjs = append(proxyObjs, coerceProxyAddress(proxy))
	}

	sourceIP, _, _ := net.SplitHostPort(remoteAddr)
	sourceObj := net.ParseIP(sourceIP)

	for _, proxyObj := range proxyObjs {
		if proxyObj.Contains(sourceObj) {
			return nil
		}
	}
	return fmt.Errorf("Request for user (%s) from %s is not from the authentication proxy", proxyHeaderValue, sourceIP)
}

func coerceProxyAddress(proxyAddr string) *net.IPNet {
	proxyAddr = strings.TrimSpace(proxyAddr)
	if !strings.Contains(proxyAddr, "/") {
		proxyAddr = strings.Join([]string{proxyAddr, "32"}, "/")
	}

	_, network, err := net.ParseCIDR(proxyAddr)
	if err != nil {
		fmt.Println(err)
	}
	return network
}
