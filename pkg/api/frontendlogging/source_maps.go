package frontendlogging

import (
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"

	sourcemap "github.com/go-sourcemap/sourcemap"

	"github.com/getsentry/sentry-go"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type sourceMapLocation struct {
	dir      string
	path     string
	pluginID string
}

type sourceMap struct {
	consumer *sourcemap.Consumer
	pluginID string
}

type sourceMapCacheType struct {
	cache map[string]*sourceMap
	sync.Mutex
}

var sourceMapCache = sourceMapCacheType{
	cache: make(map[string]*sourceMap),
}

func guessSourceMapLocation(sourceURL string) (*sourceMapLocation, error) {
	u, err := url.Parse(sourceURL)
	if err != nil {
		return nil, err
	}
	if strings.HasPrefix(u.Path, "/public/build/") {
		return &sourceMapLocation{
			dir:      setting.StaticRootPath,
			path:     filepath.Join("build", u.Path[len("/public/build/"):]) + ".map",
			pluginID: "",
		}, nil
	} else if strings.HasPrefix(u.Path, "/public/plugins/") {
		for _, route := range plugins.StaticRoutes {
			pluginPrefix := filepath.Join("/public/plugins/", route.PluginId)
			if strings.HasPrefix(u.Path, pluginPrefix) {
				return &sourceMapLocation{
					dir:      route.Directory,
					path:     u.Path[len(pluginPrefix):] + ".map",
					pluginID: route.PluginId,
				}, nil
			}
		}
	}
	return nil, nil
}

func getSourceMap(sourceURL string) (*sourceMap, error) {
	sourceMapCache.Lock()
	defer sourceMapCache.Unlock()

	if smap, ok := sourceMapCache.cache[sourceURL]; ok {
		return smap, nil
	}
	sourceMapLocation, err := guessSourceMapLocation(sourceURL)
	if err != nil {
		return nil, err
	}
	if sourceMapLocation != nil {
		dir := http.Dir(sourceMapLocation.dir)
		f, err := dir.Open(sourceMapLocation.path)
		if err != nil {
			if os.IsNotExist(err) {
				sourceMapCache.cache[sourceURL] = nil
				return nil, nil
			}
			return nil, err
		}
		defer func() {
			if err := f.Close(); err != nil {
				logger.Error("Failed to close source map file.", "err", err)
			}
		}()
		b, err := ioutil.ReadAll(f)
		if err != nil {
			return nil, err
		}
		consumer, err := sourcemap.Parse(sourceURL+".map", b)
		if err != nil {
			return nil, err
		}
		smap := &sourceMap{
			consumer: consumer,
			pluginID: sourceMapLocation.pluginID,
		}
		sourceMapCache.cache[sourceURL] = smap
		return smap, nil
	}
	sourceMapCache.cache[sourceURL] = nil
	return nil, nil
}

func resolveSourceLocation(frame sentry.Frame) (*sentry.Frame, error) {
	smap, err := getSourceMap(frame.Filename)
	if err != nil {
		return nil, err
	}
	if smap != nil {
		file, function, line, col, ok := smap.consumer.Source(frame.Lineno, frame.Colno)
		if ok {
			if len(function) == 0 {
				function = "?"
			}
			module := "core"
			if len(smap.pluginID) > 0 {
				module = smap.pluginID
			}
			return &sentry.Frame{
				Filename: file,
				Lineno:   line,
				Colno:    col,
				Function: function,
				Module:   module,
			}, nil
		}
	}
	return nil, nil
}
