package frontendlogging

import (
	"fmt"
	"strings"

	"github.com/getsentry/sentry-go"
	"github.com/inconshreveable/log15"
)

type FrontendSentryExceptionValue struct {
	Value      string            `json:"value,omitempty"`
	Type       string            `json:"type,omitempty"`
	Stacktrace sentry.Stacktrace `json:"stacktrace,omitempty"`
}

type FrontendSentryException struct {
	Values []FrontendSentryExceptionValue `json:"values,omitempty"`
}

type FrontendSentryEvent struct {
	*sentry.Event
	Exception *FrontendSentryException `json:"exception,omitempty"`
}

func (value *FrontendSentryExceptionValue) FmtMessage() string {
	return fmt.Sprintf("%s: %s", value.Type, value.Value)
}

func (value *FrontendSentryExceptionValue) FmtStacktrace() string {
	var stacktrace = value.FmtMessage()
	for _, frame := range value.Stacktrace.Frames {
		mappedLocation, err := resolveSourceLocation(frame.Filename, frame.Lineno, frame.Colno)
		if err != nil {
			// frontendLogger.Error("Error resolving stack trace frame source location.", "err", err)
		}
		if mappedLocation != nil {
			tag := "core"
			if len(mappedLocation.pluginId) > 0 {
				tag = mappedLocation.pluginId
			}
			stacktrace += fmt.Sprintf("\n  at %s (%s|%s:%v:%v)", mappedLocation.function, tag, mappedLocation.file, mappedLocation.line, mappedLocation.col)
		} else {
			stacktrace += fmt.Sprintf("\n  at %s (%s:%v:%v)", frame.Function, frame.Filename, frame.Lineno, frame.Colno)
		}
	}
	return stacktrace
}

func (exception *FrontendSentryException) FmtStacktraces() string {
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

func (event *FrontendSentryEvent) ToLogContext() log15.Ctx {
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
