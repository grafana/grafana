package middleware

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"

	"github.com/ryanuber/go-glob"
)

func ValidateActionUrl(cfg *setting.Cfg, logger log.Logger) web.Handler {
	return func(c *contextmodel.ReqContext) {
		// ignore local render calls
		if c.IsRenderCall {
			return
		}

		// only process POST and PUT
		if c.Req.Method != http.MethodPost && c.Req.Method != http.MethodPut {
			return
		}

		if c.IsApiRequest() {
			// check if action header exists
			action := c.Req.Header.Get("X-Grafana-Action")

			if action == "" {
				// header not found, this is not an action request
				return
			}

			urlToCheck := c.Req.URL
			// get the urls allowed from server config
			pathsToCheck := util.SplitString(cfg.ActionsAllowPostURL)
			logger.Info("Checking url", "actions", urlToCheck.Path)
			for _, i := range pathsToCheck {
				logger.Info("Checking match", "actions", i)
				matched := glob.Glob(i, urlToCheck.Path)
				if matched && action != "" {
					// allowed
					logger.Info("POST/PUT call matches allow configuration settings", "ValidateActionUrl", i)
					return
				}
			}
			logger.Warn("POST/PUT to path not allowed", "ValidateActionUrl", urlToCheck)
			c.JsonApiErr(http.StatusForbidden, fmt.Sprintf("POST/PUT to path not allowed: %s", urlToCheck), nil)
			return
		}
	}
}
