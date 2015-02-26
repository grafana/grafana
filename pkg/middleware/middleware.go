package middleware

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/Unknwon/macaron"
	"github.com/macaron-contrib/session"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/apikeygen"
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
		} else if keyString := getApiKey(ctx); keyString != "" {
			// base64 decode key
			decoded, err := apikeygen.Decode(keyString)
			if err != nil {
				ctx.JsonApiErr(401, "Invalid API key", err)
				return
			}
			// fetch key
			keyQuery := m.GetApiKeyByNameQuery{KeyName: decoded.Name, OrgId: decoded.OrgId}
			if err := bus.Dispatch(&keyQuery); err != nil {
				ctx.JsonApiErr(401, "Invalid API key", err)
				return
			} else {
				apikey := keyQuery.Result

				// validate api key
				if !apikeygen.IsValid(decoded, apikey.Key) {
					ctx.JsonApiErr(401, "Invalid API key", err)
					return
				}

				ctx.IsSignedIn = true
				ctx.SignedInUser = &m.SignedInUser{}

				// TODO: fix this
				ctx.OrgRole = apikey.Role
				ctx.ApiKeyId = apikey.Id
				ctx.OrgId = apikey.OrgId
			}
		} else if setting.AnonymousEnabled {
			orgQuery := m.GetOrgByNameQuery{Name: setting.AnonymousOrgName}
			if err := bus.Dispatch(&orgQuery); err != nil {
				if err == m.ErrOrgNotFound {
					log.Error(3, "Anonymous access organization name does not exist", nil)
				}
			} else {
				ctx.IsSignedIn = false
				ctx.HasAnonymousAccess = true
				ctx.SignedInUser = &m.SignedInUser{}
				ctx.OrgRole = m.RoleType(setting.AnonymousOrgRole)
				ctx.OrgId = orgQuery.Result.Id
				ctx.OrgName = orgQuery.Result.Name
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
