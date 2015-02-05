package middleware

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/Unknwon/macaron"
	"github.com/macaron-contrib/session"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type Context struct {
	*macaron.Context
	*m.SignedInUser

	Session session.Store

	IsSignedIn         bool
	HasAnonymousAccess bool
}

func GetContextHandler() macaron.Handler {
	return func(c *macaron.Context, sess session.Store) {
		ctx := &Context{
			Context:            c,
			Session:            sess,
			SignedInUser:       &m.SignedInUser{},
			IsSignedIn:         false,
			HasAnonymousAccess: false,
		}

		// try get account id from request
		if userId := getRequestUserId(ctx); userId != 0 {
			query := m.GetSignedInUserQuery{UserId: userId}
			if err := bus.Dispatch(&query); err != nil {
				log.Error(3, "Failed to get user by id, %v, %v", userId, err)
			} else {
				ctx.SignedInUser = query.Result
				ctx.IsSignedIn = true
			}
		} else if key := getApiKey(ctx); key != "" {
			// Try API Key auth
			keyQuery := m.GetApiKeyByKeyQuery{Key: key}
			if err := bus.Dispatch(&keyQuery); err != nil {
				ctx.JsonApiErr(401, "Invalid API key", err)
				return
			} else {
				keyInfo := keyQuery.Result

				ctx.IsSignedIn = true
				ctx.SignedInUser = &m.SignedInUser{}

				// TODO: fix this
				ctx.AccountRole = keyInfo.Role
				ctx.ApiKeyId = keyInfo.Id
				ctx.AccountId = keyInfo.AccountId
			}
		} else if setting.AnonymousEnabled {
			accountQuery := m.GetAccountByNameQuery{Name: setting.AnonymousAccountName}
			if err := bus.Dispatch(&accountQuery); err != nil {
				if err == m.ErrAccountNotFound {
					log.Error(3, "Anonymous access account name does not exist", nil)
				}
			} else {
				ctx.IsSignedIn = false
				ctx.HasAnonymousAccess = true
				ctx.SignedInUser = &m.SignedInUser{}
				ctx.AccountRole = m.RoleType(setting.AnonymousAccountRole)
				ctx.AccountId = accountQuery.Result.Id
			}
		}

		c.Map(ctx)
	}
}

// Handle handles and logs error by given status.
func (ctx *Context) Handle(status int, title string, err error) {
	if err != nil {
		log.Error(4, "%s: %v", title, err)
		if setting.Env != setting.PROD {
			ctx.Data["ErrorMsg"] = err
		}
	}

	ctx.Data["Title"] = title

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
