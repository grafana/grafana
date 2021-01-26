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

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

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

type sourceMapCacheType struct {
	cache map[string]*sourceMap
	sync.Mutex
}

var sourceMapCache = sourceMapCacheType{
	cache: make(map[string]*sourceMap),
}

func guessSourceMapLocation(sourceUrl string) (*sourceMapLocation, error) {
	u, err := url.Parse(sourceUrl)
	if err != nil {
		return nil, err
	}
	if strings.HasPrefix(u.Path, "/public/build/") {
		return &sourceMapLocation{
			dir:      setting.StaticRootPath,
			path:     filepath.Join("build", u.Path[len("/public/build/"):]) + ".map",
			pluginId: "",
		}, nil
	} else if strings.HasPrefix(u.Path, "/public/plugins/") {
		for _, route := range plugins.StaticRoutes {
			pluginPrefix := filepath.Join("/public/plugins/", route.PluginId)
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
	sourceMapLocation, err := guessSourceMapLocation(sourceUrl)
	if err != nil {
		return nil, err
	}
	if sourceMapLocation != nil {
		dir := http.Dir(sourceMapLocation.dir)
		f, err := dir.Open(sourceMapLocation.path)
		if err != nil {
			if os.IsNotExist(err) {
				sourceMapCache.cache[sourceUrl] = nil
				return nil, nil
			}
			return nil, err
		}
		defer func() {
			if err := f.Close(); err != nil {
				// frontendLogger.Error("Failed to close source map file.", "err", err)
			}
		}()
		b, err := ioutil.ReadAll(f)
		if err != nil {
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
