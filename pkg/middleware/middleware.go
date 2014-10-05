package middleware

import (
	"time"

	"github.com/Unknwon/macaron"
	"github.com/macaron-contrib/session"

	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/models"
)

type Context struct {
	*macaron.Context
	Session session.Store

	Account     *models.Account
	UserAccount *models.Account

	IsSigned bool
}

func GetContextHandler() macaron.Handler {
	return func(c *macaron.Context) {
		ctx := &Context{
			Context: c,
		}

		ctx.Data["PageStartTime"] = time.Now()

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

	ctx.HTML(status, "index")
}
