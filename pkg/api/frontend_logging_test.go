package api

import (
	"net/http"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	log "github.com/inconshreveable/log15"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type logScenarioFunc func(c *scenarioContext, logs []*log.Record)

func logSentryEventScenario(t *testing.T, desc string, event frontendSentryEvent, fn logScenarioFunc) {
	t.Run(desc, func(t *testing.T) {
		logs := []*log.Record{}
		origHandler := frontendLogger.GetHandler()
		frontendLogger.SetHandler(log.FuncHandler(func(r *log.Record) error {
			logs = append(logs, r)
			return nil
		}))
		t.Cleanup(func() {
			frontendLogger.SetHandler(origHandler)
		})

		sc := setupScenarioContext(t, "/log")
		hs := HTTPServer{}

		handler := routing.Wrap(func(w http.ResponseWriter, c *models.ReqContext) response.Response {
			sc.context = c
			return hs.logFrontendMessage(c, event)
		})

		sc.m.Post(sc.url, handler)
		sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
		fn(sc, logs)
	})
}

func TestFrontendLoggingEndpoint(t *testing.T) {
	ts, err := time.Parse("2006-01-02T15:04:05.000Z", "2020-10-22T06:29:29.078Z")
	require.NoError(t, err)

	t.Run("FrontendLoggingEndpoint", func(t *testing.T) {
		request := sentry.Request{
			URL: "http://localhost:3000/",
			Headers: map[string]string{
				"User-Agent": "Chrome",
			},
		}

		user := sentry.User{
			Email: "geralt@kaermorhen.com",
			ID:    "45",
		}

		errorEvent := frontendSentryEvent{
			&sentry.Event{
				EventID:   "123",
				Level:     sentry.LevelError,
				Request:   &request,
				Timestamp: ts,
			},
			&frontendSentryException{
				Values: []frontendSentryExceptionValue{
					{
						Type:  "UserError",
						Value: "Please replace user and try again",
						Stacktrace: sentry.Stacktrace{
							Frames: []sentry.Frame{
								{
									Function: "foofn",
									Filename: "foo.js",
									Lineno:   123,
									Colno:    23,
								},
								{
									Function: "barfn",
									Filename: "bar.js",
									Lineno:   113,
									Colno:    231,
								},
							},
						},
					},
				},
			},
		}

		logSentryEventScenario(t, "Should log received error event", errorEvent, func(sc *scenarioContext, logs []*log.Record) {
			assert.Equal(t, 200, sc.resp.Code)
			assert.Len(t, logs, 1)
			assertContextContains(t, logs[0], "logger", "frontend")
			assertContextContains(t, logs[0], "url", errorEvent.Request.URL)
			assertContextContains(t, logs[0], "user_agent", errorEvent.Request.Headers["User-Agent"])
			assertContextContains(t, logs[0], "event_id", errorEvent.EventID)
			assertContextContains(t, logs[0], "original_timestamp", errorEvent.Timestamp)
			assertContextContains(t, logs[0], "stacktrace", `UserError: Please replace user and try again
  at foofn (foo.js:123:23)
  at barfn (bar.js:113:231)`)
			assert.NotContains(t, logs[0].Ctx, "context")
		})

		messageEvent := frontendSentryEvent{
			&sentry.Event{
				EventID:   "123",
				Level:     sentry.LevelInfo,
				Request:   &request,
				Timestamp: ts,
				Message:   "hello world",
				User:      user,
			},
			nil,
		}

		logSentryEventScenario(t, "Should log received message event", messageEvent, func(sc *scenarioContext, logs []*log.Record) {
			assert.Equal(t, 200, sc.resp.Code)
			assert.Len(t, logs, 1)
			assert.Equal(t, "hello world", logs[0].Msg)
			assert.Equal(t, log.LvlInfo, logs[0].Lvl)
			assertContextContains(t, logs[0], "logger", "frontend")
			assertContextContains(t, logs[0], "url", messageEvent.Request.URL)
			assertContextContains(t, logs[0], "user_agent", messageEvent.Request.Headers["User-Agent"])
			assertContextContains(t, logs[0], "event_id", messageEvent.EventID)
			assertContextContains(t, logs[0], "original_timestamp", messageEvent.Timestamp)
			assert.NotContains(t, logs[0].Ctx, "stacktrace")
			assert.NotContains(t, logs[0].Ctx, "context")
			assertContextContains(t, logs[0], "user_email", user.Email)
			assertContextContains(t, logs[0], "user_id", user.ID)
		})

		eventWithContext := frontendSentryEvent{
			&sentry.Event{
				EventID:   "123",
				Level:     sentry.LevelInfo,
				Request:   &request,
				Timestamp: ts,
				Message:   "hello world",
				User:      user,
				Contexts: map[string]interface{}{
					"foo": map[string]interface{}{
						"one":   "two",
						"three": 4,
					},
					"bar": "baz",
				},
			},
			nil,
		}

		logSentryEventScenario(t, "Should log event context", eventWithContext, func(sc *scenarioContext, logs []*log.Record) {
			assert.Equal(t, 200, sc.resp.Code)
			assert.Len(t, logs, 1)
			assertContextContains(t, logs[0], "context_foo_one", "two")
			assertContextContains(t, logs[0], "context_foo_three", "4")
			assertContextContains(t, logs[0], "context_bar", "baz")
		})
	})
}

func indexOf(arr []interface{}, item string) int {
	for i, elem := range arr {
		if elem == item {
			return i
		}
	}
	return -1
}

func assertContextContains(t *testing.T, logRecord *log.Record, label string, value interface{}) {
	assert.Contains(t, logRecord.Ctx, label)
	labelIdx := indexOf(logRecord.Ctx, label)
	assert.Equal(t, value, logRecord.Ctx[labelIdx+1])
}
