package api

import (
	"errors"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/grafana/grafana/pkg/api/frontendlogging"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	log "github.com/inconshreveable/log15"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type SourceMapReadRecord struct {
	dir  string
	path string
}

type logScenarioFunc func(c *scenarioContext, logs []*log.Record, sourceMapReads []SourceMapReadRecord)

func logSentryEventScenario(t *testing.T, desc string, event frontendlogging.FrontendSentryEvent, fn logScenarioFunc) {
	t.Run(desc, func(t *testing.T) {
		logs := []*log.Record{}
		sourceMapReads := []SourceMapReadRecord{}

		origHandler := frontendLogger.GetHandler()
		frontendLogger.SetHandler(log.FuncHandler(func(r *log.Record) error {
			logs = append(logs, r)
			return nil
		}))
		t.Cleanup(func() {
			frontendLogger.SetHandler(origHandler)
		})

		sc := setupScenarioContext(t, "/log")

		cfg := &setting.Cfg{
			StaticRootPath: "/staticroot",
		}

		readSourceMap := func(dir string, path string) ([]byte, error) {
			sourceMapReads = append(sourceMapReads, SourceMapReadRecord{
				dir:  dir,
				path: path,
			})
			if strings.Contains(path, "error") {
				return nil, errors.New("epic hard drive failure")
			}
			if strings.HasSuffix(path, "foo.js.map") {
				f, err := ioutil.ReadFile("./frontendlogging/test-data/foo.js.map")
				require.NoError(t, err)
				return f, nil
			}
			return nil, os.ErrNotExist
		}

		sourceMapStore := frontendlogging.NewSourceMapStore(cfg, readSourceMap)

		loggingHandler := NewFrontendLogMessageHandler(sourceMapStore)

		handler := routing.Wrap(func(w http.ResponseWriter, c *models.ReqContext) response.Response {
			sc.context = c
			return loggingHandler(c, event)
		})

		sc.m.Post(sc.url, handler)
		sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
		fn(sc, logs, sourceMapReads)
	})
}

func TestFrontendLoggingEndpoint(t *testing.T) {
	ts, err := time.Parse("2006-01-02T15:04:05.000Z", "2020-10-22T06:29:29.078Z")
	require.NoError(t, err)

	// fake plugin route so we will try to find a source map there. I can't believe I can do this
	plugins.StaticRoutes = append(plugins.StaticRoutes, &plugins.PluginStaticRoute{
		Directory: "/usr/local/telepathic-panel",
		PluginId:  "telepathic",
	})

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

		event := sentry.Event{
			EventID:   "123",
			Level:     sentry.LevelError,
			Request:   &request,
			Timestamp: ts,
		}

		errorEvent := frontendlogging.FrontendSentryEvent{
			Event: &event,
			Exception: &frontendlogging.FrontendSentryException{
				Values: []frontendlogging.FrontendSentryExceptionValue{
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

		logSentryEventScenario(t, "Should log received error event", errorEvent, func(sc *scenarioContext, logs []*log.Record, sourceMapReads []SourceMapReadRecord) {
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

		messageEvent := frontendlogging.FrontendSentryEvent{
			Event: &sentry.Event{
				EventID:   "123",
				Level:     sentry.LevelInfo,
				Request:   &request,
				Timestamp: ts,
				Message:   "hello world",
				User:      user,
			},
			Exception: nil,
		}

		logSentryEventScenario(t, "Should log received message event", messageEvent, func(sc *scenarioContext, logs []*log.Record, sourceMapReads []SourceMapReadRecord) {
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

		eventWithContext := frontendlogging.FrontendSentryEvent{
			Event: &sentry.Event{
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
			Exception: nil,
		}

		logSentryEventScenario(t, "Should log event context", eventWithContext, func(sc *scenarioContext, logs []*log.Record, sourceMapReads []SourceMapReadRecord) {
			assert.Equal(t, 200, sc.resp.Code)
			assert.Len(t, logs, 1)
			assertContextContains(t, logs[0], "context_foo_one", "two")
			assertContextContains(t, logs[0], "context_foo_three", "4")
			assertContextContains(t, logs[0], "context_bar", "baz")
		})

		errorEventForSourceMapping := frontendlogging.FrontendSentryEvent{
			Event: &event,
			Exception: &frontendlogging.FrontendSentryException{
				Values: []frontendlogging.FrontendSentryExceptionValue{
					{
						Type:  "UserError",
						Value: "Please replace user and try again",
						Stacktrace: sentry.Stacktrace{
							Frames: []sentry.Frame{
								{
									Function: "foofn",
									Filename: "http://localhost:3000/public/build/moo/foo.js", // source map found and mapped, core
									Lineno:   2,
									Colno:    5,
								},
								{
									Function: "foofn",
									Filename: "http://localhost:3000/public/plugins/telepathic/foo.js", // plugin, source map found and mapped
									Lineno:   3,
									Colno:    10,
								},
								{
									Function: "explode",
									Filename: "http://localhost:3000/public/build/error.js", // reading source map throws error
									Lineno:   3,
									Colno:    10,
								},
								{
									Function: "wat",
									Filename: "http://localhost:3000/public/build/bar.js", // core, but source map not found on fs
									Lineno:   3,
									Colno:    10,
								},
								{
									Function: "nope",
									Filename: "http://localhost:3000/baz.js", // not core or plugin, wont even attempt to get source map
									Lineno:   3,
									Colno:    10,
								},
								{
									Function: "fake",
									Filename: "http://localhost:3000/public/build/../../secrets.txt", // path will be sanitized
									Lineno:   3,
									Colno:    10,
								},
							},
						},
					},
				},
			},
		}

		logSentryEventScenario(t, "Should load sourcemap and transform stacktrace line when possible", errorEventForSourceMapping, func(sc *scenarioContext, logs []*log.Record, sourceMapReads []SourceMapReadRecord) {
			assert.Equal(t, 200, sc.resp.Code)
			assert.Len(t, logs, 1)
			assertContextContains(t, logs[0], "stacktrace", `UserError: Please replace user and try again
  at ? (core|webpack:///./some_source.ts:2:2)
  at ? (telepathic|webpack:///./some_source.ts:3:2)
  at explode (http://localhost:3000/public/build/error.js:3:10)
  at wat (http://localhost:3000/public/build/bar.js:3:10)
  at nope (http://localhost:3000/baz.js:3:10)
  at fake (http://localhost:3000/public/build/../../secrets.txt:3:10)`)
			assert.Len(t, sourceMapReads, 5)
			assert.Equal(t, "/staticroot", sourceMapReads[0].dir)
			assert.Equal(t, "build/moo/foo.js.map", sourceMapReads[0].path)
			assert.Equal(t, "/usr/local/telepathic-panel", sourceMapReads[1].dir)
			assert.Equal(t, "/foo.js.map", sourceMapReads[1].path)
			assert.Equal(t, "/staticroot", sourceMapReads[2].dir)
			assert.Equal(t, "build/error.js.map", sourceMapReads[2].path)
			assert.Equal(t, "/staticroot", sourceMapReads[3].dir)
			assert.Equal(t, "build/bar.js.map", sourceMapReads[3].path)
			assert.Equal(t, "/staticroot", sourceMapReads[4].dir)
			assert.Equal(t, "secrets.txt.map", sourceMapReads[4].path)
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
