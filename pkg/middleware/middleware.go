package middleware

import (
	"strconv"
	"strings"

	"github.com/Unknwon/macaron"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Context struct {
	*macaron.Context
	*m.SignedInUser

	Session SessionStore

	IsSignedIn     bool
	AllowAnonymous bool
}

func GetContextHandler() macaron.Handler {
	return func(c *macaron.Context) {
		ctx := &Context{
			Context:        c,
			SignedInUser:   &m.SignedInUser{},
			Session:        GetSession(),
			IsSignedIn:     false,
			AllowAnonymous: false,
		}

		// the order in which these are tested are important
		// look for api key in Authorization header first
		// then init session and look for userId in session
		// then look for api key in session (special case for render calls via api)
		// then test if anonymous access is enabled
		if initContextWithApiKey(ctx) ||
			initContextWithBasicAuth(ctx) ||
			initContextWithAuthProxy(ctx) ||
			initContextWithUserSessionCookie(ctx) ||
			initContextWithApiKeyFromSession(ctx) ||
			initContextWithAnonymousUser(ctx) {
		}

		c.Map(ctx)
	}
}

func initContextWithAnonymousUser(ctx *Context) bool {
	if !setting.AnonymousEnabled {
		return false
	}

	orgQuery := m.GetOrgByNameQuery{Name: setting.AnonymousOrgName}
	if err := bus.Dispatch(&orgQuery); err != nil {
		log.Error(3, "Anonymous access organization error: '%s': %s", setting.AnonymousOrgName, err)
		return false
	} else {
		ctx.IsSignedIn = false
		ctx.AllowAnonymous = true
		ctx.SignedInUser = &m.SignedInUser{}
		ctx.OrgRole = m.RoleType(setting.AnonymousOrgRole)
		ctx.OrgId = orgQuery.Result.Id
		ctx.OrgName = orgQuery.Result.Name
		return true
	}
}

func initContextWithUserSessionCookie(ctx *Context) bool {
	// initialize session
	if err := ctx.Session.Start(ctx); err != nil {
		log.Error(3, "Failed to start session", err)
		return false
	}

	var userId int64
	if userId = getRequestUserId(ctx); userId == 0 {
		return false
	}

	query := m.GetSignedInUserQuery{UserId: userId}
	if err := bus.Dispatch(&query); err != nil {
		log.Error(3, "Failed to get user with id %v", userId)
		return false
	} else {
		ctx.SignedInUser = query.Result
		ctx.IsSignedIn = true
		return true
	}
}

func initContextWithApiKey(ctx *Context) bool {
	var keyString string
	if keyString = getApiKey(ctx); keyString == "" {
		return false
	}

	// base64 decode key
	decoded, err := apikeygen.Decode(keyString)
	if err != nil {
		ctx.JsonApiErr(401, "Invalid API key", err)
		return true
	}
	// fetch key
	keyQuery := m.GetApiKeyByNameQuery{KeyName: decoded.Name, OrgId: decoded.OrgId}
	if err := bus.Dispatch(&keyQuery); err != nil {
		ctx.JsonApiErr(401, "Invalid API key", err)
		return true
	} else {
		apikey := keyQuery.Result

		// validate api key
		if !apikeygen.IsValid(decoded, apikey.Key) {
			ctx.JsonApiErr(401, "Invalid API key", err)
			return true
		}

		ctx.IsSignedIn = true
		ctx.SignedInUser = &m.SignedInUser{}
		ctx.OrgRole = apikey.Role
		ctx.ApiKeyId = apikey.Id
		ctx.OrgId = apikey.OrgId
		return true
	}
}

func initContextWithBasicAuth(ctx *Context) bool {
	if !setting.BasicAuthEnabled {
		return false
	}

	header := ctx.Req.Header.Get("Authorization")
	if header == "" {
		return false
	}

	username, password, err := util.DecodeBasicAuthHeader(header)
	if err != nil {
		ctx.JsonApiErr(401, "Invalid Basic Auth Header", err)
		return true
	}

	loginQuery := m.GetUserByLoginQuery{LoginOrEmail: username}
	if err := bus.Dispatch(&loginQuery); err != nil {
		ctx.JsonApiErr(401, "Basic auth failed", err)
		return true
	}

	user := loginQuery.Result

	// validate password
	if util.EncodePassword(password, user.Salt) != user.Password {
		ctx.JsonApiErr(401, "Invalid username or password", nil)
		return true
	}

	query := m.GetSignedInUserQuery{UserId: user.Id}
	if err := bus.Dispatch(&query); err != nil {
		ctx.JsonApiErr(401, "Authentication error", err)
		return true
	} else {
		ctx.SignedInUser = query.Result
		ctx.IsSignedIn = true
		return true
	}
}

// special case for panel render calls with api key
func initContextWithApiKeyFromSession(ctx *Context) bool {
	keyId := ctx.Session.Get(SESS_KEY_APIKEY)
	if keyId == nil {
		return false
	}

	keyQuery := m.GetApiKeyByIdQuery{ApiKeyId: keyId.(int64)}
	if err := bus.Dispatch(&keyQuery); err != nil {
		log.Error(3, "Failed to get api key by id", err)
		return false
	} else {
		apikey := keyQuery.Result

		ctx.IsSignedIn = true
		ctx.SignedInUser = &m.SignedInUser{}
		ctx.OrgRole = apikey.Role
		ctx.ApiKeyId = apikey.Id
		ctx.OrgId = apikey.OrgId
		return true
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

	switch status {
	case 200:
		metrics.M_Page_Status_200.Inc(1)
	case 404:
		metrics.M_Page_Status_404.Inc(1)
	case 500:
		metrics.M_Page_Status_500.Inc(1)
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
		metrics.M_Api_Status_404.Inc(1)
		resp["message"] = "Not Found"
	case 500:
		metrics.M_Api_Status_500.Inc(1)
		resp["message"] = "Internal Server Error"
	}

	if message != "" {
		resp["message"] = message
	}

	ctx.JSON(status, resp)
}
