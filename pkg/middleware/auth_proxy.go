package middleware

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

func initContextWithAuthProxy(ctx *Context) bool {
	if !setting.AuthProxyEnabled {
		return false
	}

	if setting.AuthProxyHeaderProperty != "email" && setting.AuthProxyHeaderProperty != "username" {
		panic("Auth proxy header property invalid")
	}

	// Populate all possible headers
	proxyHeaders := map[string]string{
		"email":    ctx.Req.Header.Get(setting.AuthProxyEmailHeaderName),
		"username": ctx.Req.Header.Get(setting.AuthProxyUsernameHeaderName),
		"name":     ctx.Req.Header.Get(setting.AuthProxyNameHeaderName),
		"company":  ctx.Req.Header.Get(setting.AuthProxyCompanyHeaderName),
	}
	proxyHeaderValue := proxyHeaders[setting.AuthProxyHeaderProperty]

	if len(proxyHeaderValue) == 0 {
		return false
	}

	query := getSignedInUserQueryForProxyAuth(proxyHeaderValue)
	if err := bus.Dispatch(query); err != nil {
		if err != m.ErrUserNotFound {
			ctx.Handle(500, "Failed find user specifed in auth proxy header", err)
			return true
		}

		if setting.AuthProxyAutoSignUp {
			cmd := getCreateUserCommandForProxyAuth(proxyHeaders)
			if err := bus.Dispatch(cmd); err != nil {
				ctx.Handle(500, "Failed to create user specified in auth proxy header", err)
				return true
			}
			query = &m.GetSignedInUserQuery{UserId: cmd.Result.Id}
			if err := bus.Dispatch(query); err != nil {
				ctx.Handle(500, "Failed find user after creation", err)
				return true
			}
		} else {
			return false
		}
	}

	ctx.SignedInUser = query.Result
	ctx.IsSignedIn = true
	return true
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

func getCreateUserCommandForProxyAuth(headers map[string]string) *m.CreateUserCommand {
	cmd := m.CreateUserCommand{}
	if setting.AuthProxyHeaderProperty == "username" {
		cmd.Login = headers["username"]
		cmd.Email = headers["email"]
	} else if setting.AuthProxyHeaderProperty == "email" {
		cmd.Email = headers["email"]
		cmd.Login = headers["username"]
	} else {
		panic("Auth proxy header property invalid")
	}
	cmd.Name = headers["name"]
	cmd.Company = headers["company"]

	return &cmd
}
