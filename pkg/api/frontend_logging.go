package api

import (
	"net/http"

	"github.com/getsentry/sentry-go"
	"github.com/grafana/grafana/pkg/api/frontendlogging"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/web"
)

var frontendLogger = log.New("frontend")

type frontendLogMessageHandler func(hs *HTTPServer, c *web.Context)

func NewFrontendLogMessageHandler(store *frontendlogging.SourceMapStore) frontendLogMessageHandler {
	return func(hs *HTTPServer, c *web.Context) {
		event := frontendlogging.FrontendSentryEvent{}
		if err := web.Bind(c.Req, &event); err != nil {
			c.Resp.WriteHeader(http.StatusBadRequest)
			_, err = c.Resp.Write([]byte("bad request data"))
			if err != nil {
				hs.log.Error("could not write to response", "err", err)
			}
			return
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
			frontendLogger.Error(msg, ctx...)
		case sentry.LevelWarning:
			frontendLogger.Warn(msg, ctx...)
		case sentry.LevelDebug:
			frontendLogger.Debug(msg, ctx...)
		default:
			frontendLogger.Info(msg, ctx...)
		}

		c.Resp.WriteHeader(http.StatusAccepted)
		c.Resp.Write([]byte("OK"))
	}
}

func GrafanaJavascriptAgentLogMessageHandler(store *frontendlogging.SourceMapStore) frontendLogMessageHandler {
	return func(hs *HTTPServer, c *web.Context) {
		event := frontendlogging.FrontendGrafanaJavascriptAgentEvent{}
		if err := web.Bind(c.Req, &event); err != nil {
			c.Resp.WriteHeader(http.StatusBadRequest)
			_, err = c.Resp.Write([]byte("bad request data"))
			if err != nil {
				hs.log.Error("could not write to response", "err", err)
			}
		}

		// Meta object is standard across event types, adding it globally.

		if event.Logs != nil && len(event.Logs) > 0 {
			for _, logEntry := range event.Logs {
				var ctx = frontendlogging.CtxVector{}
				ctx = event.AddMetaToContext(ctx)
				ctx = append(ctx, "kind", "log", "original_timestamp", logEntry.Timestamp)

				for k, v := range frontendlogging.KeyValToInterfaceMap(logEntry.KeyValContext()) {
					ctx = append(ctx, k, v)
				}
				switch logEntry.LogLevel {
				case frontendlogging.LogLevelDebug, frontendlogging.LogLevelTrace:
					{
						ctx = append(ctx, "original_log_level", logEntry.LogLevel)
						frontendLogger.Debug(logEntry.Message, ctx...)
					}
				case frontendlogging.LogLevelError:
					{
						ctx = append(ctx, "original_log_level", logEntry.LogLevel)
						frontendLogger.Error(logEntry.Message, ctx...)
					}
				case frontendlogging.LogLevelWarning:
					{
						ctx = append(ctx, "original_log_level", logEntry.LogLevel)
						frontendLogger.Warn(logEntry.Message, ctx...)
					}
				default:
					{
						ctx = append(ctx, "original_log_level", logEntry.LogLevel)
						frontendLogger.Info(logEntry.Message, ctx...)
					}
				}
			}
		}

		if event.Measurements != nil && len(event.Measurements) > 0 {
			for _, measurementEntry := range event.Measurements {
				for measurementName, measurementValue := range measurementEntry.Values {
					var ctx = frontendlogging.CtxVector{}
					ctx = event.AddMetaToContext(ctx)
					ctx = append(ctx, measurementName, measurementValue)
					ctx = append(ctx, "kind", "measurement", "original_timestamp", measurementEntry.Timestamp)
					frontendLogger.Info("Measurement: "+measurementEntry.Type, ctx...)
				}
			}
		}
		if event.Exceptions != nil && len(event.Exceptions) > 0 {
			for _, exception := range event.Exceptions {
				var ctx = frontendlogging.CtxVector{}
				ctx = event.AddMetaToContext(ctx)
				exception := exception
				transformedException := frontendlogging.TransformException(&exception, store)
				ctx = append(ctx, "kind", "exception", "type", transformedException.Type, "value", transformedException.Value, "stacktrace", transformedException.String())
				ctx = append(ctx, "original_timestamp", exception.Timestamp)
				frontendLogger.Error(exception.Message(), ctx...)
			}
		}
		c.Resp.WriteHeader(http.StatusAccepted)
		_, err := c.Resp.Write([]byte("OK"))
		if err != nil {
			hs.log.Error("could not write to response", "err", err)
		}
	}
}
