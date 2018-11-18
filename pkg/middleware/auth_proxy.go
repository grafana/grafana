package middleware

import (
	"fmt"
	"net"
	"net/mail"
	"reflect"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/login"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/session"
	"github.com/grafana/grafana/pkg/setting"
)

var AUTH_PROXY_SESSION_VAR = "authProxyHeaderValue"

func initContextWithAuthProxy(ctx *m.ReqContext, orgID int64) bool {
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

	// initialize session
	if err := ctx.Session.Start(ctx.Context); err != nil {
		log.Error(3, "Failed to start session. error %v", err)
		return false
	}

	query := &m.GetSignedInUserQuery{OrgId: orgID}

	// if this session has already been authenticated by authProxy just load the user
	sessProxyValue := ctx.Session.Get(AUTH_PROXY_SESSION_VAR)
	if sessProxyValue != nil && sessProxyValue.(string) == proxyHeaderValue && getRequestUserId(ctx) > 0 {
		// if we're using ldap, sync user periodically
		if setting.LdapEnabled {
			syncQuery := &m.LoginUserQuery{
				ReqContext: ctx,
				Username:   proxyHeaderValue,
			}

			if err := syncGrafanaUserWithLdapUser(syncQuery); err != nil {
				if err == login.ErrInvalidCredentials {
					ctx.Handle(500, "Unable to authenticate user", err)
					return false
				}

				ctx.Handle(500, "Failed to sync user", err)
				return false
			}
		}

		query.UserId = getRequestUserId(ctx)
		// if we're using ldap, pass authproxy login name to ldap user sync
	} else if setting.LdapEnabled {
		ctx.Session.Delete(session.SESS_KEY_LASTLDAPSYNC)

		syncQuery := &m.LoginUserQuery{
			ReqContext: ctx,
			Username:   proxyHeaderValue,
		}

		if err := syncGrafanaUserWithLdapUser(syncQuery); err != nil {
			if err == login.ErrInvalidCredentials {
				ctx.Handle(500, "Unable to authenticate user", err)
				return false
			}

			ctx.Handle(500, "Failed to sync user", err)
			return false
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

	// Make sure that we cannot share a session between different users!
	if getRequestUserId(ctx) > 0 && getRequestUserId(ctx) != query.Result.UserId {
		// remove session
		if err := ctx.Session.Destory(ctx.Context); err != nil {
			log.Error(3, "Failed to destroy session. error: %v", err)
		}

		// initialize a new session
		if err := ctx.Session.Start(ctx.Context); err != nil {
			log.Error(3, "Failed to start session. error: %v", err)
		}
	}

	ctx.Session.Set(AUTH_PROXY_SESSION_VAR, proxyHeaderValue)

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	ctx.Session.Set(session.SESS_KEY_USERID, ctx.UserId)

	return true
}

var syncGrafanaUserWithLdapUser = func(query *m.LoginUserQuery) error {
	expireEpoch := time.Now().Add(time.Duration(-setting.AuthProxyLdapSyncTtl) * time.Minute).Unix()

	var lastLdapSync int64
	if lastLdapSyncInSession := query.ReqContext.Session.Get(session.SESS_KEY_LASTLDAPSYNC); lastLdapSyncInSession != nil {
		lastLdapSync = lastLdapSyncInSession.(int64)
	}

	if lastLdapSync < expireEpoch {
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

		query.ReqContext.Session.Set(session.SESS_KEY_LASTLDAPSYNC, time.Now().Unix())
	}

	return nil
}

func checkAuthenticationProxy(remoteAddr string, proxyHeaderValue string) error {
	if len(strings.TrimSpace(setting.AuthProxyWhitelist)) == 0 {
		return nil
	}

	proxies := strings.Split(setting.AuthProxyWhitelist, ",")
	sourceIP, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return err
	}

	// Compare allowed IP addresses to actual address
	for _, proxyIP := range proxies {
		if sourceIP == strings.TrimSpace(proxyIP) {
			return nil
		}
	}

	return fmt.Errorf("Request for user (%s) from %s is not from the authentication proxy", proxyHeaderValue, sourceIP)
}
