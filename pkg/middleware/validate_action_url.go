package middleware

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
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

		// only process requests targeting local instance
		if !isLocalPath(c) {
			// call next on url
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
				// header not found, just return
				return
			}

			urlToCheck := c.Req.URL
			// get the urls allowed from server config
			pathsToCheck := util.SplitString(cfg.ActionsAllowPostURL)
			logger.Info("Checking url", "actions", urlToCheck.Path)
			for _, i := range pathsToCheck {
				logger.Info("Checking match", "actions", i)
				matched := glob.Glob(i, urlToCheck.Path)
				/*
					matched, err := path.Match(i, urlToCheck.Path)
					if err != nil {
						// match error, ignore
						logger.Warn("Error matching configured paths", "err", err)
						c.JsonApiErr(http.StatusForbidden, fmt.Sprintf("Error matching configured paths: %s", err.Error()), nil)
						return
					}
				*/
				if matched {
					// allowed
					logger.Info("POST/PUT call matches allow configuration settings", "actions_allow_post_url", i)
					return
				}
			}
			logger.Warn("POST/PUT to path not allowed", "warn", urlToCheck)
			c.JsonApiErr(http.StatusForbidden, fmt.Sprintf("POST/PUT to path not allowed: %s", urlToCheck), nil)
			return
		}
	}
}

// isLocalPath
// Actions are processed by internal api paths, this checks the URL to ensure the request is to the local instance
func isLocalPath(c *contextmodel.ReqContext) bool {
	netAddr, err := util.SplitHostPortDefault(c.Req.Host, "", "0") // we ignore the port
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, fmt.Sprintf("Error parsing request for action: %s", err.Error()), nil)
		return false
	}

	urlAddr, err := util.SplitHostPortDefault(c.Req.URL.Host, "", "0") // we ignore the port
	if err != nil {
		// match error, ignore
		logger.Warn("Error getting url address", "err", err)
		return false
	}
	pathIsLocal := urlAddr.Host == netAddr.Host
	if netAddr.Host != "" || pathIsLocal {
		// request is local
		return true
	}

	return false
}
