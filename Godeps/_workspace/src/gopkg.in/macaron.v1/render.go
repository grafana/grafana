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
	"encoding/xml"
	"fmt"
	"html/template"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/Unknwon/com"
)

const (
	_CONTENT_TYPE    = "Content-Type"
	_CONTENT_LENGTH  = "Content-Length"
	_CONTENT_BINARY  = "application/octet-stream"
	_CONTENT_JSON    = "application/json"
	_CONTENT_HTML    = "text/html"
	_CONTENT_PLAIN   = "text/plain"
	_CONTENT_XHTML   = "application/xhtml+xml"
	_CONTENT_XML     = "text/xml"
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
	// TemplateFile represents a interface of template file that has name and can be read.
	TemplateFile interface {
		Name() string
		Data() []byte
		Ext() string
	}
	// TemplateFileSystem represents a interface of template file system that able to list all files.
	TemplateFileSystem interface {
		ListFiles() []TemplateFile
	}

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
		// Layout template name. Will not render a layout if "". Default is to "".
		Layout string
		// Extensions to parse template files from. Defaults are [".tmpl", ".html"].
		Extensions []string
		// Funcs is a slice of FuncMaps to apply to the template upon compilation. This is useful for helper functions. Default is [].
		Funcs []template.FuncMap
		// Delims sets the action delimiters to the specified strings in the Delims struct.
		Delims Delims
		// Appends the given charset to the Content-Type header. Default is "UTF-8".
		Charset string
		// Outputs human readable JSON.
		IndentJSON bool
		// Outputs human readable XML.
		IndentXML bool
		// Prefixes the JSON output with the given bytes.
		PrefixJSON []byte
		// Prefixes the XML output with the given bytes.
		PrefixXML []byte
		// Allows changing of output to XHTML instead of HTML. Default is "text/html"
		HTMLContentType string
		// TemplateFileSystem is the interface for supporting any implmentation of template file system.
		TemplateFileSystem
	}

	// HTMLOptions is a struct for overriding some rendering Options for specific HTML call
	HTMLOptions struct {
		// Layout template name. Overrides Options.Layout.
		Layout string
	}

	Render interface {
		http.ResponseWriter
		SetResponseWriter(http.ResponseWriter)

		JSON(int, interface{})
		JSONString(interface{}) (string, error)
		RawData(int, []byte)   // Serve content as binary
		PlainText(int, []byte) // Serve content as plain text
		HTML(int, string, interface{}, ...HTMLOptions)
		HTMLSet(int, string, string, interface{}, ...HTMLOptions)
		HTMLSetString(string, string, interface{}, ...HTMLOptions) (string, error)
		HTMLString(string, interface{}, ...HTMLOptions) (string, error)
		HTMLSetBytes(string, string, interface{}, ...HTMLOptions) ([]byte, error)
		HTMLBytes(string, interface{}, ...HTMLOptions) ([]byte, error)
		XML(int, interface{})
		Error(int, ...string)
		Status(int)
		SetTemplatePath(string, string)
		HasTemplateSet(string) bool
	}
)

// TplFile implements TemplateFile interface.
type TplFile struct {
	name string
	data []byte
	ext  string
}

// NewTplFile cerates new template file with given name and data.
func NewTplFile(name string, data []byte, ext string) *TplFile {
	return &TplFile{name, data, ext}
}

func (f *TplFile) Name() string {
	return f.name
}

func (f *TplFile) Data() []byte {
	return f.data
}

func (f *TplFile) Ext() string {
	return f.ext
}

// TplFileSystem implements TemplateFileSystem interface.
type TplFileSystem struct {
	files []TemplateFile
}

// NewTemplateFileSystem creates new template file system with given options.
func NewTemplateFileSystem(opt RenderOptions, omitData bool) TplFileSystem {
	fs := TplFileSystem{}
	fs.files = make([]TemplateFile, 0, 10)

	if err := filepath.Walk(opt.Directory, func(path string, info os.FileInfo, err error) error {
		r, err := filepath.Rel(opt.Directory, path)
		if err != nil {
			return err
		}

		ext := GetExt(r)

		for _, extension := range opt.Extensions {
			if ext == extension {
				var data []byte
				if !omitData {
					data, err = ioutil.ReadFile(path)
					if err != nil {
						return err
					}
				}

				name := filepath.ToSlash((r[0 : len(r)-len(ext)]))
				fs.files = append(fs.files, NewTplFile(name, data, ext))
				break
			}
		}

		return nil
	}); err != nil {
		panic("NewTemplateFileSystem: " + err.Error())
	}

	return fs
}

func (fs TplFileSystem) ListFiles() []TemplateFile {
	return fs.files
}

func PrepareCharset(charset string) string {
	if len(charset) != 0 {
		return "; charset=" + charset
	}

	return "; charset=" + _DEFAULT_CHARSET
}

func GetExt(s string) string {
	index := strings.Index(s, ".")
	if index == -1 {
		return ""
	}
	return s[index:]
}

func compile(opt RenderOptions) *template.Template {
	dir := opt.Directory
	t := template.New(dir)
	t.Delims(opt.Delims.Left, opt.Delims.Right)
	// Parse an initial template in case we don't have any.
	template.Must(t.Parse("Macaron"))

	if opt.TemplateFileSystem == nil {
		opt.TemplateFileSystem = NewTemplateFileSystem(opt, false)
	}

	for _, f := range opt.TemplateFileSystem.ListFiles() {
		tmpl := t.New(f.Name())
		for _, funcs := range opt.Funcs {
			tmpl.Funcs(funcs)
		}
		// Bomb out if parse fails. We don't want any silent server starts.
		template.Must(tmpl.Funcs(helperFuncs).Parse(string(f.Data())))
	}

	return t
}

const (
	_DEFAULT_TPL_SET_NAME = "DEFAULT"
)

// templateSet represents a template set of type *template.Template.
type templateSet struct {
	lock sync.RWMutex
	sets map[string]*template.Template
	dirs map[string]string
}

func newTemplateSet() *templateSet {
	return &templateSet{
		sets: make(map[string]*template.Template),
		dirs: make(map[string]string),
	}
}

func (ts *templateSet) Set(name string, opt *RenderOptions) *template.Template {
	t := compile(*opt)

	ts.lock.Lock()
	defer ts.lock.Unlock()

	ts.sets[name] = t
	ts.dirs[name] = opt.Directory
	return t
}

func (ts *templateSet) Get(name string) *template.Template {
	ts.lock.RLock()
	defer ts.lock.RUnlock()

	return ts.sets[name]
}

func (ts *templateSet) GetDir(name string) string {
	ts.lock.RLock()
	defer ts.lock.RUnlock()

	return ts.dirs[name]
}

func prepareRenderOptions(options []RenderOptions) RenderOptions {
	var opt RenderOptions
	if len(options) > 0 {
		opt = options[0]
	}

	// Defaults.
	if len(opt.Directory) == 0 {
		opt.Directory = "templates"
	}
	if len(opt.Extensions) == 0 {
		opt.Extensions = []string{".tmpl", ".html"}
	}
	if len(opt.HTMLContentType) == 0 {
		opt.HTMLContentType = _CONTENT_HTML
	}

	return opt
}

func ParseTplSet(tplSet string) (tplName string, tplDir string) {
	tplSet = strings.TrimSpace(tplSet)
	if len(tplSet) == 0 {
		panic("empty template set argument")
	}
	infos := strings.Split(tplSet, ":")
	if len(infos) == 1 {
		tplDir = infos[0]
		tplName = path.Base(tplDir)
	} else {
		tplName = infos[0]
		tplDir = infos[1]
	}

	if !com.IsDir(tplDir) {
		panic("template set path does not exist or is not a directory")
	}
	return tplName, tplDir
}

func renderHandler(opt RenderOptions, tplSets []string) Handler {
	cs := PrepareCharset(opt.Charset)
	ts := newTemplateSet()
	ts.Set(_DEFAULT_TPL_SET_NAME, &opt)

	var tmpOpt RenderOptions
	for _, tplSet := range tplSets {
		tplName, tplDir := ParseTplSet(tplSet)
		tmpOpt = opt
		tmpOpt.Directory = tplDir
		ts.Set(tplName, &tmpOpt)
	}

	return func(ctx *Context) {
		r := &TplRender{
			ResponseWriter:  ctx.Resp,
			templateSet:     ts,
			Opt:             &opt,
			CompiledCharset: cs,
		}
		ctx.Data["TmplLoadTimes"] = func() string {
			if r.startTime.IsZero() {
				return ""
			}
			return fmt.Sprint(time.Since(r.startTime).Nanoseconds()/1e6) + "ms"
		}

		ctx.Render = r
		ctx.MapTo(r, (*Render)(nil))
	}
}

// Renderer is a Middleware that maps a macaron.Render service into the Macaron handler chain.
// An single variadic macaron.RenderOptions struct can be optionally provided to configure
// HTML rendering. The default directory for templates is "templates" and the default
// file extension is ".tmpl" and ".html".
//
// If MACARON_ENV is set to "" or "development" then templates will be recompiled on every request. For more performance, set the
// MACARON_ENV environment variable to "production".
func Renderer(options ...RenderOptions) Handler {
	return renderHandler(prepareRenderOptions(options), []string{})
}

func Renderers(options RenderOptions, tplSets ...string) Handler {
	return renderHandler(prepareRenderOptions([]RenderOptions{options}), tplSets)
}

type TplRender struct {
	http.ResponseWriter
	*templateSet
	Opt             *RenderOptions
	CompiledCharset string

	startTime time.Time
}

func (r *TplRender) SetResponseWriter(rw http.ResponseWriter) {
	r.ResponseWriter = rw
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
	r.Header().Set(_CONTENT_TYPE, _CONTENT_JSON+r.CompiledCharset)
	r.WriteHeader(status)
	if len(r.Opt.PrefixJSON) > 0 {
		r.Write(r.Opt.PrefixJSON)
	}
	r.Write(result)
}

func (r *TplRender) JSONString(v interface{}) (string, error) {
	var result []byte
	var err error
	if r.Opt.IndentJSON {
		result, err = json.MarshalIndent(v, "", "  ")
	} else {
		result, err = json.Marshal(v)
	}
	if err != nil {
		return "", err
	}
	return string(result), nil
}

func (r *TplRender) XML(status int, v interface{}) {
	var result []byte
	var err error
	if r.Opt.IndentXML {
		result, err = xml.MarshalIndent(v, "", "  ")
	} else {
		result, err = xml.Marshal(v)
	}
	if err != nil {
		http.Error(r, err.Error(), 500)
		return
	}

	// XML rendered fine, write out the result
	r.Header().Set(_CONTENT_TYPE, _CONTENT_XML+r.CompiledCharset)
	r.WriteHeader(status)
	if len(r.Opt.PrefixXML) > 0 {
		r.Write(r.Opt.PrefixXML)
	}
	r.Write(result)
}

func (r *TplRender) data(status int, contentType string, v []byte) {
	if r.Header().Get(_CONTENT_TYPE) == "" {
		r.Header().Set(_CONTENT_TYPE, contentType)
	}
	r.WriteHeader(status)
	r.Write(v)
}

func (r *TplRender) RawData(status int, v []byte) {
	r.data(status, _CONTENT_BINARY, v)
}

func (r *TplRender) PlainText(status int, v []byte) {
	r.data(status, _CONTENT_PLAIN, v)
}

func (r *TplRender) execute(t *template.Template, name string, data interface{}) (*bytes.Buffer, error) {
	buf := bufpool.Get().(*bytes.Buffer)
	return buf, t.ExecuteTemplate(buf, name, data)
}

func (r *TplRender) addYield(t *template.Template, tplName string, data interface{}) {
	funcs := template.FuncMap{
		"yield": func() (template.HTML, error) {
			buf, err := r.execute(t, tplName, data)
			// return safe html here since we are rendering our own template
			return template.HTML(buf.String()), err
		},
		"current": func() (string, error) {
			return tplName, nil
		},
	}
	t.Funcs(funcs)
}

func (r *TplRender) renderBytes(setName, tplName string, data interface{}, htmlOpt ...HTMLOptions) (*bytes.Buffer, error) {
	t := r.templateSet.Get(setName)
	if Env == DEV {
		opt := *r.Opt
		opt.Directory = r.templateSet.GetDir(setName)
		t = r.templateSet.Set(setName, &opt)
	}
	if t == nil {
		return nil, fmt.Errorf("html/template: template \"%s\" is undefined", tplName)
	}

	opt := r.prepareHTMLOptions(htmlOpt)

	if len(opt.Layout) > 0 {
		r.addYield(t, tplName, data)
		tplName = opt.Layout
	}

	out, err := r.execute(t, tplName, data)
	if err != nil {
		return nil, err
	}

	return out, nil
}

func (r *TplRender) renderHTML(status int, setName, tplName string, data interface{}, htmlOpt ...HTMLOptions) {
	r.startTime = time.Now()

	out, err := r.renderBytes(setName, tplName, data, htmlOpt...)
	if err != nil {
		http.Error(r, err.Error(), http.StatusInternalServerError)
		return
	}

	r.Header().Set(_CONTENT_TYPE, r.Opt.HTMLContentType+r.CompiledCharset)
	r.WriteHeader(status)

	out.WriteTo(r)
	bufpool.Put(out)
}

func (r *TplRender) HTML(status int, name string, data interface{}, htmlOpt ...HTMLOptions) {
	r.renderHTML(status, _DEFAULT_TPL_SET_NAME, name, data, htmlOpt...)
}

func (r *TplRender) HTMLSet(status int, setName, tplName string, data interface{}, htmlOpt ...HTMLOptions) {
	r.renderHTML(status, setName, tplName, data, htmlOpt...)
}

func (r *TplRender) HTMLSetBytes(setName, tplName string, data interface{}, htmlOpt ...HTMLOptions) ([]byte, error) {
	out, err := r.renderBytes(setName, tplName, data, htmlOpt...)
	if err != nil {
		return []byte(""), err
	}
	return out.Bytes(), nil
}

func (r *TplRender) HTMLBytes(name string, data interface{}, htmlOpt ...HTMLOptions) ([]byte, error) {
	return r.HTMLSetBytes(_DEFAULT_TPL_SET_NAME, name, data, htmlOpt...)
}

func (r *TplRender) HTMLSetString(setName, tplName string, data interface{}, htmlOpt ...HTMLOptions) (string, error) {
	p, err := r.HTMLSetBytes(setName, tplName, data, htmlOpt...)
	return string(p), err
}

func (r *TplRender) HTMLString(name string, data interface{}, htmlOpt ...HTMLOptions) (string, error) {
	p, err := r.HTMLBytes(name, data, htmlOpt...)
	return string(p), err
}

// Error writes the given HTTP status to the current ResponseWriter
func (r *TplRender) Error(status int, message ...string) {
	r.WriteHeader(status)
	if len(message) > 0 {
		r.Write([]byte(message[0]))
	}
}

func (r *TplRender) Status(status int) {
	r.WriteHeader(status)
}

func (r *TplRender) prepareHTMLOptions(htmlOpt []HTMLOptions) HTMLOptions {
	if len(htmlOpt) > 0 {
		return htmlOpt[0]
	}

	return HTMLOptions{
		Layout: r.Opt.Layout,
	}
}

func (r *TplRender) SetTemplatePath(setName, dir string) {
	if len(setName) == 0 {
		setName = _DEFAULT_TPL_SET_NAME
	}
	opt := *r.Opt
	opt.Directory = dir
	r.templateSet.Set(setName, &opt)
}

func (r *TplRender) HasTemplateSet(name string) bool {
	return r.templateSet.Get(name) != nil
}
