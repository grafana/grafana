package api

import (
	"net/http"

	"github.com/getsentry/sentry-go"
	"github.com/grafana/grafana/pkg/api/frontendlogging"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

var frontendLogger = log.New("frontend")

type frontendLogMessageHandler func(c *models.ReqContext) response.Response

func NewFrontendLogMessageHandler(store *frontendlogging.SourceMapStore) frontendLogMessageHandler {
	return func(c *models.ReqContext) response.Response {
		event := frontendlogging.FrontendSentryEvent{}
		if err := web.Bind(c.Req, &event); err != nil {
			return response.Error(http.StatusBadRequest, "bad request data", err)
		}

		var msg = "unknown"

		if len(event.Message) > 0 {
			msg = event.Message
		} else if event.Exception != nil && len(event.Exception.Values) > 0 {
			msg = event.Exception.Values[0].FmtMessage()
		}

		var ctx = event.ToLogContext(store)

		switch event.Level {
		case sentry.LevelError:
			frontendLogger.Error(msg, ctx)
		case sentry.LevelWarning:
			frontendLogger.Warn(msg, ctx)
		case sentry.LevelDebug:
			frontendLogger.Debug(msg, ctx)
		default:
			frontendLogger.Info(msg, ctx)
		}

		return response.Success("ok")
	}
}
