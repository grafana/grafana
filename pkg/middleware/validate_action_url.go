package middleware

import (
	"fmt"
	"net/http"
	"path"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func ValidateActionUrl(cfg *setting.Cfg) web.Handler {
	return func(c *contextmodel.ReqContext) {
		// ignore local render calls
		if c.IsRenderCall {
			return
		}

		// TODO: only process same origin requests

		// only process POST and PUT
		if c.Req.Method != http.MethodPost && c.Req.Method != http.MethodPut {
			return
		}

		if c.IsApiRequest() {
			// check if action header exists
			action := c.Req.Header.Get("X-Grafana-Action")

			if action == "" {
				// header not found, just return
				return
			}

			urlToCheck := c.Req.URL
			// get the urls allowed from server config
			pathsToCheck := util.SplitString(cfg.ActionsAllowPostURL)
			for _, i := range pathsToCheck {
				matched, err := path.Match(i, urlToCheck.Path)
				if err != nil {
					// match error, ignore
					logger.Warn("Error matching configured paths", "err", err)
					c.JsonApiErr(http.StatusForbidden, fmt.Sprintf("Error matching configured paths: %s", err.Error()), nil)
					return
				}
				if matched {
					// allowed
					logger.Debug("API call allowed", "path", i)
					return
				}
			}
			logger.Warn("POST/PUT to path not allowed", "warn", urlToCheck)
			c.JsonApiErr(http.StatusForbidden, fmt.Sprintf("POST/PUT to path not allowed: %s", urlToCheck), nil)
			return
		}
	}
}
