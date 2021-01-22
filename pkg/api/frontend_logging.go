package api

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"sync"

	"github.com/getsentry/sentry-go"
	sourcemap "github.com/go-sourcemap/sourcemap"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/inconshreveable/log15"
)

var frontendLogger = log.New("frontend")

type sourceLocation struct {
	file     string
	function string
	line     int
	col      int
	pluginId string
}

type sourceMapLocation struct {
	dir      string
	path     string
	pluginId string
}

type sourceMap struct {
	consumer *sourcemap.Consumer
	pluginId string
}

// source file url to sourcemap consume
type sourceMapCacheType struct {
	cache map[string]*sourceMap
	sync.Mutex
}

var sourceMapCache = sourceMapCacheType{
	cache: make(map[string]*sourceMap),
}

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

func guessSourceMapLocation(sourceUrl string) (*sourceMapLocation, error) {
	u, err := url.Parse(sourceUrl)
	if err != nil {
		return nil, err
	}
	if strings.HasPrefix(u.Path, "/public/build/") {
		return &sourceMapLocation{
			dir:      setting.StaticRootPath,
			path:     path.Join("build", u.Path[len("/public/build/"):]) + ".map",
			pluginId: "",
		}, nil
	} else if strings.HasPrefix(u.Path, "/public/plugins/") {
		for _, route := range plugins.StaticRoutes {
			pluginPrefix := path.Join("/public/plugins/", route.PluginId)
			if strings.HasPrefix(u.Path, pluginPrefix) {
				return &sourceMapLocation{
					dir:      route.Directory,
					path:     u.Path[len(pluginPrefix):] + ".map",
					pluginId: route.PluginId,
				}, nil
			}
		}
	}
	return nil, nil
}

func getSourceMap(sourceUrl string) (*sourceMap, error) {
	sourceMapCache.Lock()
	defer sourceMapCache.Unlock()

	if smap, ok := sourceMapCache.cache[sourceUrl]; ok {
		return smap, nil
	}
	frontendLogger.Info("getSourcemapConsumer", "url", sourceUrl)
	sourceMapLocation, err := guessSourceMapLocation(sourceUrl)
	if err != nil {
		return nil, err
	}
	if sourceMapLocation != nil {
		dir := http.Dir(sourceMapLocation.dir)
		f, err := dir.Open(sourceMapLocation.path)
		if err != nil {
			if os.IsNotExist(err) {
				frontendLogger.Error("smap not exist :shrug:", "file", sourceMapLocation.path)
				sourceMapCache.cache[sourceUrl] = nil
				return nil, nil
			}
			frontendLogger.Error("failed to open sourcemap file", "file", sourceMapLocation.path)
			return nil, err
		}
		defer func() {
			if err := f.Close(); err != nil {
				frontendLogger.Error("Failed to close file", err)
			}
		}()
		b, err := ioutil.ReadAll(f)
		if err != nil {
			frontendLogger.Error("failed to read sourcemap file", "file", sourceMapLocation.path)
			return nil, err
		}
		consumer, err := sourcemap.Parse(sourceUrl+".map", b)
		if err != nil {
			return nil, err
		}
		smap := &sourceMap{
			consumer: consumer,
			pluginId: sourceMapLocation.pluginId,
		}
		sourceMapCache.cache[sourceUrl] = smap
		return smap, nil
	} else {
		sourceMapCache.cache[sourceUrl] = nil
	}
	return nil, nil
}

func resolveSourceLocation(url string, line int, column int) (*sourceLocation, error) {
	smap, err := getSourceMap(url)
	if err != nil {
		return nil, err
	}
	if smap != nil {
		file, function, line, col, ok := smap.consumer.Source(line, column)
		if ok {
			frontendLogger.Info("got a hit!", "url", url, "file", file)
			if len(function) == 0 {
				function = "?"
			}
			return &sourceLocation{
				file:     file,
				line:     line,
				col:      col,
				function: function,
				pluginId: smap.pluginId,
			}, nil
		}
	}
	return nil, nil
}

func (value *frontendSentryExceptionValue) FmtMessage() string {
	return fmt.Sprintf("%s: %s", value.Type, value.Value)
}

func (value *frontendSentryExceptionValue) FmtStacktrace() string {
	var stacktrace = value.FmtMessage()
	for _, frame := range value.Stacktrace.Frames {
		mappedLocation, err := resolveSourceLocation(frame.Filename, frame.Lineno, frame.Colno)
		if err != nil {
			frontendLogger.Error("Failed get sourcemap.", err)
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
