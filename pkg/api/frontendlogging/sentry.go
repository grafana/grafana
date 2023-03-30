package frontendlogging

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/getsentry/sentry-go"

	"github.com/grafana/grafana/pkg/infra/log"
)

type CtxVector []interface{}

var logger = log.New("frontendlogging")

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

func fmtLine(frame sentry.Frame) string {
	module := ""
	if len(frame.Module) > 0 {
		module = frame.Module + "|"
	}
	return fmt.Sprintf("\n  at %s (%s%s:%v:%v)", frame.Function, module, frame.Filename, frame.Lineno, frame.Colno)
}

func (value *FrontendSentryExceptionValue) FmtStacktrace(store *SourceMapStore) string {
	var stacktrace = value.FmtMessage()
	for _, frame := range value.Stacktrace.Frames {
		mappedFrame, err := store.resolveSourceLocation(frame)
		if err != nil {
			logger.Error("Error resolving stack trace frame source location", "err", err)
			stacktrace += fmtLine(frame) // even if reading source map fails for unexpected reason, still better to log compiled location than nothing at all
		} else {
			if mappedFrame != nil {
				stacktrace += fmtLine(*mappedFrame)
			} else {
				stacktrace += fmtLine(frame)
			}
		}
	}
	return stacktrace
}

func (exception *FrontendSentryException) FmtStacktraces(store *SourceMapStore) string {
	stacktraces := make([]string, 0, len(exception.Values))
	for _, value := range exception.Values {
		stacktraces = append(stacktraces, value.FmtStacktrace(store))
	}
	return strings.Join(stacktraces, "\n\n")
}

func addEventContextToLogContext(rootPrefix string, logCtx *CtxVector, eventCtx map[string]interface{}) {
	for key, element := range eventCtx {
		prefix := fmt.Sprintf("%s_%s", rootPrefix, key)
		switch v := element.(type) {
		case map[string]interface{}:
			addEventContextToLogContext(prefix, logCtx, v)
		default:
			*logCtx = append(*logCtx, prefix, fmt.Sprintf("%v", v))
		}
	}
}

func (event *FrontendSentryEvent) ToLogContext(store *SourceMapStore) []interface{} {
	var ctx = CtxVector{"url", event.Request.URL, "user_agent", event.Request.Headers["User-Agent"],
		"event_id", event.EventID, "original_timestamp", event.Timestamp}

	if event.Exception != nil {
		ctx = append(ctx, "stacktrace", event.Exception.FmtStacktraces(store))
	}
	addEventContextToLogContext("context", &ctx, event.Contexts)
	if len(event.User.Email) > 0 {
		ctx = append(ctx, "user_email", event.User.Email, "user_id", event.User.ID)
	}

	return ctx
}

func (event *FrontendSentryEvent) MarshalJSON() ([]byte, error) {
	eventJSON, err := json.Marshal(event.Event)
	if err != nil {
		return nil, err
	}
	exceptionJSON, err := json.Marshal(map[string]interface{}{"exception": event.Exception})
	if err != nil {
		return nil, err
	}
	exceptionJSON[0] = ','
	return append(eventJSON[:len(eventJSON)-1], exceptionJSON...), nil
}
