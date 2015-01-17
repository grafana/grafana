package middleware

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/Unknwon/macaron"
	"github.com/macaron-contrib/session"

	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/log"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/setting"
)

type Context struct {
	*macaron.Context
	*m.SignedInUser

	Session session.Store

	IsSignedIn bool
}

func GetContextHandler() macaron.Handler {
	return func(c *macaron.Context, sess session.Store) {
		ctx := &Context{
			Context: c,
			Session: sess,
		}

		// try get account id from request
		if accountId := getRequestAccountId(ctx); accountId != 0 {
			query := m.GetSignedInUserQuery{AccountId: accountId}
			if err := bus.Dispatch(&query); err != nil {
				log.Error(3, "Failed to get user by id, %v, %v", accountId, err)
			} else {
				ctx.IsSignedIn = true
				ctx.SignedInUser = query.Result
			}
		} else if token := getApiToken(ctx); token != "" {
			// Try API Key auth
			tokenQuery := m.GetTokenByTokenQuery{Token: token}
			if err := bus.Dispatch(&tokenQuery); err != nil {
				ctx.JsonApiErr(401, "Invalid token", err)
				return
			} else {
				tokenInfo := tokenQuery.Result
				query := m.GetSignedInUserQuery{AccountId: tokenInfo.AccountId}
				if err := bus.Dispatch(&query); err != nil {
					ctx.JsonApiErr(401, "Invalid token", err)
					return
				}

				ctx.IsSignedIn = true
				ctx.SignedInUser = query.Result

				// api key role
				ctx.UserRole = tokenInfo.Role
				ctx.ApiKeyId = tokenInfo.Id
				ctx.UsingAccountId = ctx.AccountId
				ctx.UsingAccountName = ctx.UserName
			}
		}

		c.Map(ctx)
	}
}

// Handle handles and logs error by given status.
func (ctx *Context) Handle(status int, title string, err error) {
	if err != nil {
		log.Error(4, "%s: %v", title, err)
		if macaron.Env != macaron.PROD {
			ctx.Data["ErrorMsg"] = err
		}
	}

	switch status {
	case 404:
		ctx.Data["Title"] = "Page Not Found"
	case 500:
		ctx.Data["Title"] = "Internal Server Error"
	}

	ctx.HTML(status, strconv.Itoa(status))
}

func (ctx *Context) JsonOK(message string) {
	resp := make(map[string]interface{})

	resp["message"] = message

	ctx.JSON(200, resp)
}

func (ctx *Context) IsApiRequest() bool {
	return strings.HasPrefix(ctx.Req.URL.Path, "/api")
}

func (ctx *Context) JsonApiErr(status int, message string, err error) {
	resp := make(map[string]interface{})

	if err != nil {
		log.Error(4, "%s: %v", message, err)
		if setting.Env != setting.PROD {
			resp["error"] = err.Error()
		}
	}

	switch status {
	case 404:
		resp["message"] = "Not Found"
	case 500:
		resp["message"] = "Internal Server Error"
	}

	if message != "" {
		resp["message"] = message
	}

	ctx.JSON(status, resp)
}

func (ctx *Context) JsonBody(model interface{}) bool {
	b, _ := ctx.Req.Body().Bytes()
	err := json.Unmarshal(b, &model)
	return err == nil
}
