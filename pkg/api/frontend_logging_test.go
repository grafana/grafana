package api

import (
	"errors"
	"net/http"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/frontendlogging"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/plugins"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
)

type SourceMapReadRecord struct {
	dir  string
	path string
}

type logScenarioFunc func(c *scenarioContext, logs map[string]interface{}, sourceMapReads []SourceMapReadRecord)

func logGrafanaJavascriptAgentEventScenario(t *testing.T, desc string, event frontendlogging.FrontendGrafanaJavascriptAgentEvent, fn logScenarioFunc) {
	t.Run(desc, func(t *testing.T) {
		var logcontent = make(map[string]interface{})
		logcontent["logger"] = "frontend"
		newfrontendLogger := log.Logger(log.LoggerFunc(func(keyvals ...interface{}) error {
			for i := 0; i < len(keyvals); i += 2 {
				logcontent[keyvals[i].(string)] = keyvals[i+1]
			}
			return nil
		}))

		origHandler := frontendLogger.GetLogger()
		frontendLogger.Swap(level.NewFilter(newfrontendLogger, level.AllowInfo()))
		sourceMapReads := []SourceMapReadRecord{}

		t.Cleanup(func() {
			frontendLogger.Swap(origHandler)
		})

		sc := setupScenarioContext(t, "/log-grafana-javascript-agent")

		cdnRootURL, e := url.Parse("https://storage.googleapis.com/grafana-static-assets")
		require.NoError(t, e)

		cfg := &setting.Cfg{
			StaticRootPath: "/staticroot",
			CDNRootURL:     cdnRootURL,
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
				f, err := os.ReadFile("./frontendlogging/test-data/foo.js.map")
				require.NoError(t, err)
				return f, nil
			}
			return nil, os.ErrNotExist
		}

		// fake plugin route so we will try to find a source map there
		pm := fakePluginStaticRouteResolver{
			routes: []*plugins.StaticRoute{
				{
					Directory: "/usr/local/telepathic-panel",
					PluginID:  "telepathic",
				},
			},
		}

		sourceMapStore := frontendlogging.NewSourceMapStore(cfg, &pm, readSourceMap)

		loggingHandler := GrafanaJavascriptAgentLogMessageHandler(sourceMapStore)

		handler := routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			sc.context = c
			c.Req.Body = mockRequestBody(event)
			c.Req.Header.Add("Content-Type", "application/json")
			loggingHandler(nil, c.Context)
			return response.Success("OK")
		})

		sc.m.Post(sc.url, handler)
		sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
		fn(sc, logcontent, sourceMapReads)
	})
}

func TestFrontendLoggingEndpointGrafanaJavascriptAgent(t *testing.T) {
	ts, err := time.Parse("2006-01-02T15:04:05.000Z", "2020-10-22T06:29:29.078Z")
	require.NoError(t, err)
	t.Run("FrontendLoggingEndpointGrafanaJavascriptAgent", func(t *testing.T) {
		user := frontendlogging.User{
			Email: "test@example.com",
			ID:    "45",
		}
		meta := frontendlogging.Meta{
			User: user,
			Page: frontendlogging.Page{
				URL: "http://localhost:3000/dashboard/db/test",
			},
		}

		errorEvent := frontendlogging.FrontendGrafanaJavascriptAgentEvent{
			Meta: meta,
			Exceptions: []frontendlogging.Exception{
				{
					Type:  "UserError",
					Value: "Please replace user and try again\n  at foofn (foo.js:123:23)\n  at barfn (bar.js:113:231)",
					Stacktrace: &frontendlogging.Stacktrace{
						Frames: []frontendlogging.Frame{{
							Function: "bla",
							Filename: "http://localhost:3000/public/build/foo.js",
							Lineno:   20,
							Colno:    30,
						},
						},
					},
					Timestamp: ts,
				},
			},
		}

		logGrafanaJavascriptAgentEventScenario(t, "Should log received error event", errorEvent,
			func(sc *scenarioContext, logs map[string]interface{}, sourceMapReads []SourceMapReadRecord) {
				assert.Equal(t, http.StatusAccepted, sc.resp.Code)
				assertContextContains(t, logs, "logger", "frontend")
				assertContextContains(t, logs, "page_url", errorEvent.Meta.Page.URL)
				assertContextContains(t, logs, "user_email", errorEvent.Meta.User.Email)
				assertContextContains(t, logs, "user_id", errorEvent.Meta.User.ID)
				assertContextContains(t, logs, "original_timestamp", errorEvent.Exceptions[0].Timestamp)
				assertContextContains(t, logs, "msg", `UserError: Please replace user and try again
  at foofn (foo.js:123:23)
  at barfn (bar.js:113:231)`)
				assert.NotContains(t, logs, "context")
			})

		logEvent := frontendlogging.FrontendGrafanaJavascriptAgentEvent{
			Meta: meta,
			Logs: []frontendlogging.Log{{
				Message:   "This is a test log message",
				Timestamp: ts,
				LogLevel:  "info",
			}},
		}

		logGrafanaJavascriptAgentEventScenario(t, "Should log received log event", logEvent,
			func(sc *scenarioContext, logs map[string]interface{}, sourceMapReads []SourceMapReadRecord) {
				assert.Equal(t, http.StatusAccepted, sc.resp.Code)
				assert.Len(t, logs, 11)
				assertContextContains(t, logs, "logger", "frontend")
				assertContextContains(t, logs, "msg", "This is a test log message")
				assertContextContains(t, logs, "original_log_level", frontendlogging.LogLevel("info"))
				assertContextContains(t, logs, "original_timestamp", ts)
				assert.NotContains(t, logs, "stacktrace")
				assert.NotContains(t, logs, "context")
			})

		logEventWithContext := frontendlogging.FrontendGrafanaJavascriptAgentEvent{
			Meta: meta,
			Logs: []frontendlogging.Log{{
				Message:   "This is a test log message",
				Timestamp: ts,
				LogLevel:  "info",
				Context: map[string]string{
					"one": "two",
					"bar": "baz",
				},
			}},
		}

		logGrafanaJavascriptAgentEventScenario(t, "Should log received log context", logEventWithContext,
			func(sc *scenarioContext, logs map[string]interface{}, sourceMapReads []SourceMapReadRecord) {
				assert.Equal(t, http.StatusAccepted, sc.resp.Code)
				assertContextContains(t, logs, "context_one", "two")
				assertContextContains(t, logs, "context_bar", "baz")
			})
		errorEventForSourceMapping := frontendlogging.FrontendGrafanaJavascriptAgentEvent{
			Meta: meta,
			Exceptions: []frontendlogging.Exception{
				{
					Type:  "UserError",
					Value: "Please replace user and try again",
					Stacktrace: &frontendlogging.Stacktrace{
						Frames: []frontendlogging.Frame{
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
							{
								Function: "cdn",
								Filename: "https://storage.googleapis.com/grafana-static-assets/grafana-oss/pre-releases/7.5.0-11925pre/public/build/foo.js", // source map found and mapped
								Lineno:   3,
								Colno:    10,
							},
						},
					},
					Timestamp: ts,
				},
			},
		}

		logGrafanaJavascriptAgentEventScenario(t, "Should load sourcemap and transform stacktrace line when possible", errorEventForSourceMapping,
			func(sc *scenarioContext, logs map[string]interface{}, sourceMapReads []SourceMapReadRecord) {
				assert.Equal(t, http.StatusAccepted, sc.resp.Code)
				assertContextContains(t, logs, "stacktrace", `UserError: Please replace user and try again
  at ? (core|webpack:///./some_source.ts:2:2)
  at ? (telepathic|webpack:///./some_source.ts:3:2)
  at explode (http://localhost:3000/public/build/error.js:3:10)
  at wat (http://localhost:3000/public/build/bar.js:3:10)
  at nope (http://localhost:3000/baz.js:3:10)
  at fake (http://localhost:3000/public/build/../../secrets.txt:3:10)
  at ? (core|webpack:///./some_source.ts:3:2)`)
				assert.Len(t, sourceMapReads, 6)
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
				assert.Equal(t, "/staticroot", sourceMapReads[5].dir)
				assert.Equal(t, "build/foo.js.map", sourceMapReads[5].path)
			})

		logWebVitals := frontendlogging.FrontendGrafanaJavascriptAgentEvent{
			Meta: meta,
			Measurements: []frontendlogging.Measurement{{
				Values: map[string]float64{
					"CLS": 1.0,
				},
			},
			},
		}

		logGrafanaJavascriptAgentEventScenario(t, "Should log web vitals as context", logWebVitals,
			func(sc *scenarioContext, logs map[string]interface{}, sourceMapReads []SourceMapReadRecord) {
				assert.Equal(t, http.StatusAccepted, sc.resp.Code)
				assertContextContains(t, logs, "CLS", float64(1))
			})
	})
}

func assertContextContains(t *testing.T, logRecord map[string]interface{}, label string, value interface{}) {
	assert.Contains(t, logRecord, label)
	assert.Equal(t, value, logRecord[label])
}
