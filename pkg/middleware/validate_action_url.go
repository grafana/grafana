package middleware

import (
	"errors"
	"fmt"
	"net/http"
	"reflect"

	"github.com/gobwas/glob"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	errInvalidAllowedURL = func(url string) error {
		return fmt.Errorf("action URL '%s' is invalid", url)
	}
)

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

func ValidateActionUrl(cfg *setting.Cfg, logger log.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			e := &errorWithStatus{}
			ctx := contexthandler.FromContext(r.Context())
			// get the urls allowed from server config
			allGlobs, err := cacheGlobs(cfg.ActionsAllowPostURL)
			if err != nil {
				if !errors.As(err, &e) {
					http.Error(w, fmt.Sprintf("internal server error: expected error type errorWithStatus, got %s. Error: %v", reflect.TypeOf(err), err), http.StatusInternalServerError)
				}
				http.Error(w, err.Error(), e.HTTPStatus)
				return
			}
			matched, allowed, matchErr := check(ctx, allGlobs, logger)
			if matchErr != nil {
				if !errors.As(matchErr, &e) {
					http.Error(w, fmt.Sprintf("internal server error: expected error type errorWithStatus, got %s. Error: %v", reflect.TypeOf(err), err), http.StatusInternalServerError)
				}
				http.Error(w, matchErr.Error(), e.HTTPStatus)
				return
			}
			if matched {
				if !allowed {
					logger.Error("POST/PUT to path not allowed", "validateActionUrl", ctx.Req.URL)
					return
				} else {
					next.ServeHTTP(w, r)
				}
			}
			// allowed and no matches fall through
			next.ServeHTTP(w, r)
		})
	}
}

// check
// Detects header for action urls and compares to globbed pattern list
// returns true if allowed
func check(ctx *contextmodel.ReqContext, allGlobs *[]glob.Glob, logger log.Logger) (bool, bool, *errorWithStatus) {
	// ignore local render calls
	if ctx.IsRenderCall {
		return false, false, nil
	}
	// only process POST and PUT
	if ctx.Req.Method != http.MethodPost && ctx.Req.Method != http.MethodPut {
		return false, false, nil
	}
	// if no header
	// return nil
	// check if action header exists
	action := ctx.Req.Header.Get("X-Grafana-Action")
	if action == "" {
		// header not found, this is not an action request
		return false, false, nil
	}
	// for each split config
	// if matches glob
	// return nil
	urlToCheck := ctx.Req.URL
	if matchesAllowedPath(allGlobs, urlToCheck.Path) {
		return true, true, nil
	}
	logger.Warn("POST/PUT to path not allowed", "validateActionUrl", urlToCheck)
	// return some error
	return false, false, &errorWithStatus{
		Underlying: fmt.Errorf("POST/PUT not allowed for path %s", urlToCheck),
		HTTPStatus: http.StatusMethodNotAllowed,
	}
}

func matchesAllowedPath(allGlobs *[]glob.Glob, pathToCheck string) bool {
	logger.Info("Checking url", "actions", pathToCheck)
	for _, i := range *allGlobs {
		logger.Info("Checking match", "actions", i)
		if i.Match(pathToCheck) {
			// allowed
			logger.Info("POST/PUT call matches allow configuration settings", "ValidateActionUrl", i)
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
