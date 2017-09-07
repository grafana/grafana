package middleware

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/login"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func initContextWithAuthProxy(ctx *Context, orgId int64) bool {
	if !setting.AuthProxyEnabled {
		return false
	}

	proxyHeaderValue := ctx.Req.Header.Get(setting.AuthProxyHeaderName)
	if len(proxyHeaderValue) == 0 {
		return false
	}

	// if auth proxy ip(s) defined, check if request comes from one of those
	if err := checkAuthenticationProxy(ctx, proxyHeaderValue); err != nil {
		ctx.Handle(407, "Proxy authentication required", err)
		return true
	}

	query := getSignedInUserQueryForProxyAuth(proxyHeaderValue)
	query.OrgId = orgId
	if err := bus.Dispatch(query); err != nil {
		if err != m.ErrUserNotFound {
			ctx.Handle(500, "Failed to find user specified in auth proxy header", err)
			return true
		}

		if setting.AuthProxyAutoSignUp {
			cmd := getCreateUserCommandForProxyAuth(proxyHeaderValue)
			if setting.LdapEnabled {
				cmd.SkipOrgSetup = true
			}

			if err := bus.Dispatch(cmd); err != nil {
				ctx.Handle(500, "Failed to create user specified in auth proxy header", err)
				return true
			}
			query = &m.GetSignedInUserQuery{UserId: cmd.Result.Id, OrgId: orgId}
			if err := bus.Dispatch(query); err != nil {
				ctx.Handle(500, "Failed find user after creation", err)
				return true
			}
		} else {
			return false
		}
	}

	// initialize session
	if err := ctx.Session.Start(ctx); err != nil {
		log.Error(3, "Failed to start session", err)
		return false
	}

	// Make sure that we cannot share a session between different users!
	if getRequestUserId(ctx) > 0 && getRequestUserId(ctx) != query.Result.UserId {
		// remove session
		if err := ctx.Session.Destory(ctx); err != nil {
			log.Error(3, "Failed to destroy session, err")
		}

		// initialize a new session
		if err := ctx.Session.Start(ctx); err != nil {
			log.Error(3, "Failed to start session", err)
		}
	}

	// When ldap is enabled, sync userinfo and org roles
	if err := syncGrafanaUserWithLdapUser(ctx, query); err != nil {
		if err == login.ErrInvalidCredentials {
			ctx.Handle(500, "Unable to authenticate user", err)
			return false
		}

		ctx.Handle(500, "Failed to sync user", err)
		return false
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	ctx.Session.Set(SESS_KEY_USERID, ctx.UserId)

	return true
}

var syncGrafanaUserWithLdapUser = func(ctx *Context, query *m.GetSignedInUserQuery) error {
	if setting.LdapEnabled {
		expireEpoch := time.Now().Add(time.Duration(-setting.AuthProxyLdapSyncTtl) * time.Minute).Unix()

		var lastLdapSync int64
		if lastLdapSyncInSession := ctx.Session.Get(SESS_KEY_LASTLDAPSYNC); lastLdapSyncInSession != nil {
			lastLdapSync = lastLdapSyncInSession.(int64)
		}

		if lastLdapSync < expireEpoch {
			ldapCfg := login.LdapCfg

			for _, server := range ldapCfg.Servers {
				author := login.NewLdapAuthenticator(server)
				if err := author.SyncSignedInUser(query.Result); err != nil {
					return err
				}
			}

			ctx.Session.Set(SESS_KEY_LASTLDAPSYNC, time.Now().Unix())
		}
	}

	return nil
}

func checkAuthenticationProxy(ctx *Context, proxyHeaderValue string) error {
	if len(strings.TrimSpace(setting.AuthProxyWhitelist)) > 0 {
		proxies := strings.Split(setting.AuthProxyWhitelist, ",")
		remoteAddrSplit := strings.Split(ctx.Req.RemoteAddr, ":")
		sourceIP := remoteAddrSplit[0]

		found := false
		for _, proxyIP := range proxies {
			if sourceIP == strings.TrimSpace(proxyIP) {
				found = true
				break
			}
		}

		if !found {
			msg := fmt.Sprintf("Request for user (%s) is not from the authentication proxy", proxyHeaderValue)
			err := errors.New(msg)
			return err
		}
	}

	return nil
}

func getSignedInUserQueryForProxyAuth(headerVal string) *m.GetSignedInUserQuery {
	query := m.GetSignedInUserQuery{}
	if setting.AuthProxyHeaderProperty == "username" {
		query.Login = headerVal
	} else if setting.AuthProxyHeaderProperty == "email" {
		query.Email = headerVal
	} else {
		panic("Auth proxy header property invalid")
	}
	return &query
}

func getCreateUserCommandForProxyAuth(headerVal string) *m.CreateUserCommand {
	cmd := m.CreateUserCommand{}
	if setting.AuthProxyHeaderProperty == "username" {
		cmd.Login = headerVal
		cmd.Email = headerVal
	} else if setting.AuthProxyHeaderProperty == "email" {
		cmd.Email = headerVal
		cmd.Login = headerVal
	} else {
		panic("Auth proxy header property invalid")
	}
	return &cmd
}
