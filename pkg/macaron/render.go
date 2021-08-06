// Copyright 2013 Martini Authors
// Copyright 2014 The Macaron Authors
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

package macaron

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"sync"
)

const (
	_CONTENT_TYPE    = "Content-Type"
	_CONTENT_JSON    = "application/json"
	_CONTENT_HTML    = "text/html"
	_DEFAULT_CHARSET = "UTF-8"
)

var (
	// Provides a temporary buffer to execute templates into and catch errors.
	bufpool = sync.Pool{
		New: func() interface{} { return new(bytes.Buffer) },
	}

	// Included helper functions for use when rendering html
	helperFuncs = template.FuncMap{
		"yield": func() (string, error) {
			return "", fmt.Errorf("yield called with no layout defined")
		},
		"current": func() (string, error) {
			return "", nil
		},
	}
)

type (
	// Delims represents a set of Left and Right delimiters for HTML template rendering
	Delims struct {
		// Left delimiter, defaults to {{
		Left string
		// Right delimiter, defaults to }}
		Right string
	}

	// RenderOptions represents a struct for specifying configuration options for the Render middleware.
	RenderOptions struct {
		// Directory to load templates. Default is "templates".
		Directory string
		// Delims sets the action delimiters to the specified strings in the Delims struct.
		Delims Delims
		// Outputs human readable JSON.
		IndentJSON bool
	}

	Render interface {
		JSON(int, interface{})
		HTML(int, string, interface{})
	}
)

type TemplateFile struct {
	name string
	data []byte
	ext  string
}

// NewTplFile cerates new template file with given name and data.
func NewTplFile(name string, data []byte) TemplateFile {
	return TemplateFile{name, data, ""}
}

type TemplateFileSystem struct {
	files []TemplateFile
}

// NewTemplateFileSystem creates new template file system with given options.
func NewTemplateFileSystem(opt RenderOptions, omitData bool) TemplateFileSystem {
	fs := TemplateFileSystem{}

	// We still walk the last (original) directory because it's non-sense we load templates not exist in original directory.
	if err := filepath.Walk(opt.Directory, func(path string, info os.FileInfo, _ error) error {
		if f, err := os.Stat(path); err != nil || f.IsDir() {
			return nil
		}

		data, err := ioutil.ReadFile(path)
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(opt.Directory, path)
		if err != nil {
			return err
		}
		fs.files = append(fs.files, NewTplFile(rel, data))
		return nil
	}); err != nil {
		panic("NewTemplateFileSystem: " + err.Error())
	}
	return fs
}

func (fs TemplateFileSystem) Get(name string) (io.Reader, error) {
	for i := range fs.files {
		if fs.files[i].name == name {
			return bytes.NewReader(fs.files[i].data), nil
		}
	}
	return nil, fmt.Errorf("file '%s' not found", name)
}

func compile(opt RenderOptions) *template.Template {
	t := template.New(opt.Directory)
	t.Delims(opt.Delims.Left, opt.Delims.Right)
	// Parse an initial template in case we don't have any.
	template.Must(t.Parse("Macaron"))

	fs := NewTemplateFileSystem(opt, false)

	for _, f := range fs.files {
		basename := f.name[:len(f.name)-len(filepath.Ext(f.name))]
		tmpl := t.New(basename)
		// Bomb out if parse fails. We don't want any silent server starts.
		template.Must(tmpl.Funcs(helperFuncs).Parse(string(f.data)))
	}

	return t
}

const (
	DEFAULT_TPL_SET_NAME = "DEFAULT"
)

// TemplateSet represents a template set of type *template.Template.
type TemplateSet struct {
	lock sync.RWMutex
	sets map[string]*template.Template
	dirs map[string]string
}

// NewTemplateSet initializes a new empty template set.
func NewTemplateSet() *TemplateSet {
	return &TemplateSet{
		sets: make(map[string]*template.Template),
		dirs: make(map[string]string),
	}
}

func (ts *TemplateSet) Set(name string, opt *RenderOptions) *template.Template {
	t := compile(*opt)

	ts.lock.Lock()
	defer ts.lock.Unlock()

	ts.sets[name] = t
	ts.dirs[name] = opt.Directory
	return t
}

func (ts *TemplateSet) Get(name string) *template.Template {
	ts.lock.RLock()
	defer ts.lock.RUnlock()

	return ts.sets[name]
}

func (ts *TemplateSet) GetDir(name string) string {
	ts.lock.RLock()
	defer ts.lock.RUnlock()

	return ts.dirs[name]
}

// Renderer is a Middleware that maps a macaron.Render service into the Macaron handler chain.
// An single variadic macaron.RenderOptions struct can be optionally provided to configure
// HTML rendering. The default directory for templates is "templates" and the default
// file extension is ".html".
//
// If MACARON_ENV is set to "" or "development" then templates will be recompiled on every request. For more performance, set the
// MACARON_ENV environment variable to "production".
func Renderer(opt RenderOptions) func(http.Handler) http.Handler {
	ts := NewTemplateSet()
	ts.Set(DEFAULT_TPL_SET_NAME, &opt)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
			ctx := FromContext(req.Context())
			ctx.render = &TplRender{
				ResponseWriter: ctx.Resp,
				TemplateSet:    ts,
				Opt:            &opt,
			}
			next.ServeHTTP(rw, req)
		})
	}
}

type TplRender struct {
	http.ResponseWriter
	*TemplateSet
	Opt *RenderOptions
}

func (r *TplRender) JSON(status int, v interface{}) {
	var (
		result []byte
		err    error
	)
	if r.Opt.IndentJSON {
		result, err = json.MarshalIndent(v, "", "  ")
	} else {
		result, err = json.Marshal(v)
	}
	if err != nil {
		http.Error(r, err.Error(), 500)
		return
	}

	// json rendered fine, write out the result
	r.Header().Set(_CONTENT_TYPE, _CONTENT_JSON+"; charset="+_DEFAULT_CHARSET)
	r.WriteHeader(status)
	_, _ = r.Write(result)
}

func (r *TplRender) execute(t *template.Template, name string, data interface{}) (*bytes.Buffer, error) {
	buf := bufpool.Get().(*bytes.Buffer)
	return buf, t.ExecuteTemplate(buf, name, data)
}

func (r *TplRender) renderBytes(setName, tplName string, data interface{}) (*bytes.Buffer, error) {
	t := r.TemplateSet.Get(setName)
	if Env == DEV {
		opt := *r.Opt
		opt.Directory = r.TemplateSet.GetDir(setName)
		t = r.TemplateSet.Set(setName, &opt)
	}
	if t == nil {
		return nil, fmt.Errorf("html/template: template \"%s\" is undefined", tplName)
	}

	out, err := r.execute(t, tplName, data)
	if err != nil {
		return nil, err
	}

	return out, nil
}

func (r *TplRender) HTML(status int, name string, data interface{}) {
	out, err := r.renderBytes(DEFAULT_TPL_SET_NAME, name, data)
	if err != nil {
		http.Error(r, err.Error(), http.StatusInternalServerError)
		return
	}

	r.Header().Set(_CONTENT_TYPE, _CONTENT_HTML+"; charset="+_DEFAULT_CHARSET)
	r.WriteHeader(status)

	if _, err := out.WriteTo(r); err != nil {
		out.Reset()
	}
	bufpool.Put(out)
}
