package middleware

import (
	"fmt"
	"net/http"

	"github.com/gobwas/glob"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var errInvalidAllowedURL = func(url string) error {
	return fmt.Errorf("action URL '%s' is invalid", url)
}

type errorWithStatus struct {
	Underlying error
	HTTPStatus int
}

func (e errorWithStatus) Error() string {
	return e.Underlying.Error()
}

func (e errorWithStatus) Unwrap() error {
	return e.Underlying
}

func ValidateActionUrl(settingsProvider setting.SettingsProvider, logger log.Logger) func(http.Handler) http.Handler {
	cfg := settingsProvider.Get()
	// get the urls allowed from server config
	allGlobs, globErr := cacheGlobs(cfg.ActionsAllowPostURL)
	if globErr != nil {
		logger.Error("invalid glob settings in config section [security] actions_allow_post_url", "url", cfg.ActionsAllowPostURL)
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := contexthandler.FromContext(r.Context())
			// if no header
			// return nil
			// check if action header exists
			action := ctx.Req.Header.Get("X-Grafana-Action")
			if action == "" {
				// header not found, this is not an action request
				next.ServeHTTP(w, r)
				return
			}
			if globErr != nil {
				http.Error(w, "check server logs for glob configuration failure", http.StatusInternalServerError)
				return
			}
			matchErr := check(ctx, allGlobs, logger)
			if matchErr != nil {
				http.Error(w, matchErr.Error(), http.StatusMethodNotAllowed)
				return
			}
			// no errors fall through
			next.ServeHTTP(w, r)
		})
	}
}

// check
// Detects header for action urls and compares to globbed pattern list
// returns true if allowed
func check(ctx *contextmodel.ReqContext, allGlobs *[]glob.Glob, logger log.Logger) *errorWithStatus {
	// only process POST and PUT
	if ctx.Req.Method != http.MethodPost && ctx.Req.Method != http.MethodPut {
		return &errorWithStatus{
			Underlying: fmt.Errorf("method not allowed for path %s", ctx.Req.URL),
			HTTPStatus: http.StatusMethodNotAllowed,
		}
	}
	// for each split config
	// if matches glob
	// return nil
	urlToCheck := ctx.Req.URL
	if matchesAllowedPath(allGlobs, urlToCheck.Path) {
		return nil
	}
	logger.Warn("POST/PUT to path not allowed", "url", urlToCheck)
	// return some error
	return &errorWithStatus{
		Underlying: fmt.Errorf("method POST/PUT not allowed for path %s", urlToCheck),
		HTTPStatus: http.StatusMethodNotAllowed,
	}
}

func matchesAllowedPath(allGlobs *[]glob.Glob, pathToCheck string) bool {
	logger.Debug("Checking url", "actions", pathToCheck)
	for _, rule := range *allGlobs {
		logger.Debug("Checking match", "actions", rule)
		if rule.Match(pathToCheck) {
			// allowed
			logger.Debug("POST/PUT call matches allow configuration settings")
			return true
		}
	}
	return false
}

func cacheGlobs(actionsAllowPostURL string) (*[]glob.Glob, error) {
	allowedUrls := util.SplitString(actionsAllowPostURL)
	allGlobs := make([]glob.Glob, 0)
	for _, i := range allowedUrls {
		g, err := glob.Compile(i)
		if err != nil {
			return nil, errInvalidAllowedURL(err.Error())
		}
		allGlobs = append(allGlobs, g)
	}
	return &allGlobs, nil
}
