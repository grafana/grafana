package api

import (
	"net/http"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	log "github.com/inconshreveable/log15"
	"github.com/stretchr/testify/require"

	. "github.com/smartystreets/goconvey/convey"
)

type logScenarioFunc func(c *scenarioContext, logs []*log.Record)

func logSentryEventScenario(desc string, event frontendSentryEvent, fn logScenarioFunc) {
	Convey(desc, func() {
		logs := []*log.Record{}
		frontendLogger.SetHandler(log.FuncHandler(func(r *log.Record) error {
			logs = append(logs, r)
			return nil
		}))

		sc := setupScenarioContext("/log")
		hs := HTTPServer{}

		sc.defaultHandler = Wrap(func(w http.ResponseWriter, c *models.ReqContext) Response {
			sc.context = c
			return hs.logFrontendMessage(c, event)
		})

		sc.m.Post(sc.url, sc.defaultHandler)
		sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
		fn(sc, logs)
	})
}

func TestFrontendLoggingEndpoint(t *testing.T) {
	ts, err := time.Parse("2006-01-02T15:04:05.000Z", "2020-10-22T06:29:29.078Z")
	require.NoError(t, err)

	Convey("FrontendLoggingEndpoint", t, func() {
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

		logSentryEventScenario("Should log received error event", errorEvent, func(sc *scenarioContext, logs []*log.Record) {
			So(sc.resp.Code, ShouldEqual, 200)
			So(len(logs), ShouldEqual, 1)
			soContextContains(logs[0], "logger", "frontend")
			soContextContains(logs[0], "url", errorEvent.Request.URL)
			soContextContains(logs[0], "user_agent", errorEvent.Request.Headers["User-Agent"])
			soContextContains(logs[0], "event_id", errorEvent.EventID)
			soContextContains(logs[0], "original_timestamp", errorEvent.Timestamp)
			soContextContains(logs[0], "stacktrace", `UserError: Please replace user and try again
  at foofn (foo.js:123:23)
  at barfn (bar.js:113:231)`)
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

		logSentryEventScenario("Should log received message event", messageEvent, func(sc *scenarioContext, logs []*log.Record) {
			So(sc.resp.Code, ShouldEqual, 200)
			So(len(logs), ShouldEqual, 1)
			So(logs[0].Msg, ShouldEqual, "hello world")
			So(logs[0].Lvl, ShouldEqual, glog.LvlInfo)
			soContextContains(logs[0], "logger", "frontend")
			soContextContains(logs[0], "url", messageEvent.Request.URL)
			soContextContains(logs[0], "user_agent", messageEvent.Request.Headers["User-Agent"])
			soContextContains(logs[0], "event_id", messageEvent.EventID)
			soContextContains(logs[0], "original_timestamp", messageEvent.Timestamp)
			So(logs[0].Ctx, ShouldNotContain, "stacktrace")
			soContextContains(logs[0], "user_email", user.Email)
			soContextContains(logs[0], "user_id", user.ID)
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

func soContextContains(logRecord *log.Record, label string, value interface{}) {
	So(logRecord.Ctx, ShouldContain, label)
	labelIdx := indexOf(logRecord.Ctx, label)
	So(logRecord.Ctx[labelIdx+1], ShouldEqual, value)
}
