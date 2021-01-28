package api

import (
	"fmt"
	"strings"

	"github.com/getsentry/sentry-go"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/inconshreveable/log15"
)

var frontendLogger = log.New("frontend")

type frontendSentryExceptionValue struct {
	Value      string            `json:"value,omitempty"`
	Type       string            `json:"type,omitempty"`
	Stacktrace sentry.Stacktrace `json:"stacktrace,omitempty"`
}

type frontendSentryException struct {
	Values []frontendSentryExceptionValue `json:"values,omitempty"`
}

type frontendSentryEvent struct {
	*sentry.Event
	Exception *frontendSentryException `json:"exception,omitempty"`
}

func (value *frontendSentryExceptionValue) FmtMessage() string {
	return fmt.Sprintf("%s: %s", value.Type, value.Value)
}

func (value *frontendSentryExceptionValue) FmtStacktrace() string {
	var stacktrace = value.FmtMessage()
	for _, frame := range value.Stacktrace.Frames {
		stacktrace += fmt.Sprintf("\n  at %s (%s:%v:%v)", frame.Function, frame.Filename, frame.Lineno, frame.Colno)
	}
	return stacktrace
}

func (exception *frontendSentryException) FmtStacktraces() string {
	var stacktraces []string
	for _, value := range exception.Values {
		stacktraces = append(stacktraces, value.FmtStacktrace())
	}
	return strings.Join(stacktraces, "\n\n")
}

func addEventContextToLogContext(rootPrefix string, logCtx log15.Ctx, eventCtx map[string]interface{}) {
	for key, element := range eventCtx {
		prefix := fmt.Sprintf("%s_%s", rootPrefix, key)
		switch v := element.(type) {
		case map[string]interface{}:
			addEventContextToLogContext(prefix, logCtx, v)
		default:
			logCtx[prefix] = fmt.Sprintf("%v", v)
		}
	}
}

func (event *frontendSentryEvent) ToLogContext() log15.Ctx {
	var ctx = make(log15.Ctx)
	ctx["url"] = event.Request.URL
	ctx["user_agent"] = event.Request.Headers["User-Agent"]
	ctx["event_id"] = event.EventID
	ctx["original_timestamp"] = event.Timestamp
	if event.Exception != nil {
		ctx["stacktrace"] = event.Exception.FmtStacktraces()
	}
	addEventContextToLogContext("context", ctx, event.Contexts)
	if len(event.User.Email) > 0 {
		ctx["user_email"] = event.User.Email
		ctx["user_id"] = event.User.ID
	}

	return ctx
}

func (hs *HTTPServer) logFrontendMessage(c *models.ReqContext, event frontendSentryEvent) response.Response {
	var msg = "unknown"

	if len(event.Message) > 0 {
		msg = event.Message
	} else if event.Exception != nil && len(event.Exception.Values) > 0 {
		msg = event.Exception.Values[0].FmtMessage()
	}

	var ctx = event.ToLogContext()

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
