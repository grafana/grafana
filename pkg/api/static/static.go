// Copyright 2013 Martini Authors
// Copyright 2014 Unknwon
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package httpstatic

import (
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/web"
)

var Root string

func init() {
	var err error
	Root, err = os.Getwd()
	if err != nil {
		panic("error getting work directory: " + err.Error())
	}
}

// StaticOptions is a struct for specifying configuration options for the web.Static middleware.
type StaticOptions struct {
	// Prefix is the optional prefix used to serve the static directory content
	Prefix string
	// SkipLogging will disable [Static] log messages when a static file is served.
	SkipLogging bool
	// IndexFile defines which file to serve as index if it exists.
	IndexFile string
	// Expires defines which user-defined function to use for producing a HTTP Expires Header
	// https://developers.google.com/speed/docs/insights/LeverageBrowserCaching
	AddHeaders func(ctx *web.Context)
	// FileSystem is the interface for supporting any implementation of file system.
	FileSystem http.FileSystem
	// Exclude paths from being served
	Exclude []string
}

// FIXME: to be deleted.
type staticMap struct {
	lock sync.RWMutex
	data map[string]*http.Dir
}

func (sm *staticMap) Set(dir *http.Dir) {
	sm.lock.Lock()
	defer sm.lock.Unlock()

	sm.data[string(*dir)] = dir
}

var statics = staticMap{sync.RWMutex{}, map[string]*http.Dir{}}

// staticFileSystem implements http.FileSystem interface.
type staticFileSystem struct {
	dir *http.Dir
}

func newStaticFileSystem(directory string) staticFileSystem {
	if !filepath.IsAbs(directory) {
		directory = filepath.Join(Root, directory)
	}
	dir := http.Dir(directory)
	statics.Set(&dir)
	return staticFileSystem{&dir}
}

func (fs staticFileSystem) Open(name string) (http.File, error) {
	return fs.dir.Open(name)
}

func prepareStaticOption(dir string, opt StaticOptions) StaticOptions {
	// Defaults
	if len(opt.IndexFile) == 0 {
		opt.IndexFile = "index.html"
	}
	// Normalize the prefix if provided
	if opt.Prefix != "" {
		// Ensure we have a leading '/'
		if opt.Prefix[0] != '/' {
			opt.Prefix = "/" + opt.Prefix
		}
		// Remove any trailing '/'
		opt.Prefix = strings.TrimRight(opt.Prefix, "/")
	}
	if opt.FileSystem == nil {
		opt.FileSystem = newStaticFileSystem(dir)
	}
	return opt
}

func prepareStaticOptions(dir string, options []StaticOptions) StaticOptions {
	var opt StaticOptions
	if len(options) > 0 {
		opt = options[0]
	}
	return prepareStaticOption(dir, opt)
}

func staticHandler(ctx *web.Context, log log.Logger, opt StaticOptions) bool {
	if ctx.Req.Method != "GET" && ctx.Req.Method != "HEAD" {
		return false
	}

	file := ctx.Req.URL.Path
	for _, p := range opt.Exclude {
		if file == p {
			return false
		}
	}

	// if we have a prefix, filter requests by stripping the prefix
	if opt.Prefix != "" {
		if !strings.HasPrefix(file, opt.Prefix) {
			return false
		}
		file = file[len(opt.Prefix):]
		if file != "" && file[0] != '/' {
			return false
		}
	}

	f, err := opt.FileSystem.Open(file)
	if err != nil {
		return false
	}
	defer func() {
		if err := f.Close(); err != nil {
			log.Error("Failed to close file", "error", err)
		}
	}()

	fi, err := f.Stat()
	if err != nil {
		return true // File exists but fail to open.
	}

	// Try to serve index file
	if fi.IsDir() {
		// Redirect if missing trailing slash.
		if !strings.HasSuffix(ctx.Req.URL.Path, "/") {
			redirectPath := path.Clean(ctx.Req.URL.Path)
			redirectPath = fmt.Sprintf("%s/", redirectPath)
			if !strings.HasPrefix(redirectPath, "/") {
				// Disambiguate that it's a path relative to this server
				redirectPath = fmt.Sprintf("/%s", redirectPath)
			} else {
				// A string starting with // or /\ is interpreted by browsers as a URL, and not a server relative path
				rePrefix := regexp.MustCompile(`^(?:/\\|/+)`)
				redirectPath = rePrefix.ReplaceAllString(redirectPath, "/")
			}
			http.Redirect(ctx.Resp, ctx.Req, redirectPath, http.StatusFound)
			return true
		}

		file = path.Join(file, opt.IndexFile)
		indexFile, err := opt.FileSystem.Open(file)
		if err != nil {
			return false // Discard error.
		}
		defer func() {
			if err := indexFile.Close(); err != nil {
				log.Error("Failed to close file", "error", err)
			}
		}()

		fi, err = f.Stat()
		if err != nil || fi.IsDir() {
			return true
		}
	}

	if !opt.SkipLogging {
		log.Info("[Static] Serving", "file", file)
	}

	// Add an Expires header to the static content
	if opt.AddHeaders != nil {
		opt.AddHeaders(ctx)
	}

	http.ServeContent(ctx.Resp, ctx.Req, file, fi.ModTime(), f)
	return true
}

// Static returns a middleware handler that serves static files in the given directory.
func Static(directory string, staticOpt ...StaticOptions) web.Handler {
	opt := prepareStaticOptions(directory, staticOpt)

	logger := log.New("static")
	return func(ctx *web.Context) {
		staticHandler(ctx, logger, opt)
	}
}
