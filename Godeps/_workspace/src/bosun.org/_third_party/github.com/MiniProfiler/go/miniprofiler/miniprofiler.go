/*
 * Copyright (c) 2013 Matt Jibson <matt.jibson@gmail.com>
 *
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

package miniprofiler

import (
	"bytes"
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"os"
	"reflect"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"
)

var (
	// Enable returns true if the request should be profiled.
	Enable func(*http.Request) bool = EnableAll

	// Store stores the Profile by its Id field.
	Store func(*http.Request, *Profile) = StoreMemory

	// Get retrieves a Profile by its Id field.
	Get func(*http.Request, string) *Profile = GetMemory

	// MachineName returns the machine name to display.
	// The default is to use the machine's hostname.
	MachineName func() string = Hostname

	// Valid positions: left, right, bottomleft, bottomright
	Position = "left"

	ShowTrivial         = false
	ShowChildren        = false
	MaxTracesToShow     = 15
	ShowControls        = true
	ToggleShortcut      = "Alt+P"
	StartHidden         = false
	TrivialMilliseconds = 12.0

	Version = "3.0.11"

	staticFiles map[string][]byte
)

const (
	PATH = "/mini-profiler-resources/"

	clientTimingsPrefix = "clientPerformance[timing]["
)

var (
	webFS     = FS(false)
	fsHandler = http.FileServer(webFS)
)

func init() {
	http.Handle(PATH, http.StripPrefix(PATH, http.HandlerFunc(MiniProfilerHandler)))
}

// miniProfilerHandler serves requests to the /mini-profiler-resources/
// path. For use only by miniprofiler helper libraries.
func MiniProfilerHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "results" {
		results(w, r)
	} else {
		fsHandler.ServeHTTP(w, r)
	}
}

func results(w http.ResponseWriter, r *http.Request) {
	id := r.FormValue("id")
	isPopup := r.FormValue("popup") == "1"
	p := Get(r, id)
	if p == nil {
		http.Error(w, "", http.StatusNotFound)
		return
	}

	needsSave := false
	if p.ClientTimings == nil {
		p.ClientTimings = getClientTimings(r)
		if p.ClientTimings != nil {
			needsSave = true
		}
	}

	if needsSave {
		Store(r, p)
	}

	var j []byte
	j, err := json.Marshal(p)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if isPopup {
		w.Write(j)
	} else {
		v := map[string]interface{}{
			"name":     p.Name,
			"duration": p.DurationMilliseconds,
			"path":     PATH,
			"json":     template.JS(j),
			"includes": p.Includes(),
			"version":  Version,
		}

		w.Header().Add("Content-Type", "text/html")
		shareHtmlTmpl.Execute(w, v)
	}
}

func getClientTimings(r *http.Request) *ClientTimings {
	var navigationStart int64
	if i, err := strconv.ParseInt(r.FormValue(clientTimingsPrefix+"navigationStart]"), 10, 64); err != nil {
		return nil
	} else {
		navigationStart = i
	}
	ct := new(ClientTimings)

	if i, err := strconv.ParseInt(r.FormValue("clientPerformance[navigation][redirectCount]"), 10, 64); err == nil {
		ct.RedirectCount = i
	}

	r.ParseForm()
	clientPerf := make(map[string]ClientTiming)
	for k, v := range r.Form {
		if len(v) < 1 || !strings.HasPrefix(k, clientTimingsPrefix) {
			continue
		}

		if i, err := strconv.ParseInt(v[0], 10, 64); err == nil && i > navigationStart {
			i -= navigationStart
			name := k[len(clientTimingsPrefix) : len(k)-1]

			if strings.HasSuffix(name, "Start") {
				shortName := name[:len(name)-5]
				if c, present := clientPerf[shortName]; !present {
					clientPerf[shortName] = ClientTiming{
						Name:     shortName,
						Duration: -1,
						Start:    i,
					}
				} else {
					c.Start = i
					c.Duration -= i
					clientPerf[shortName] = c
				}
			} else if strings.HasSuffix(name, "End") {
				shortName := name[:len(name)-3]
				if c, present := clientPerf[shortName]; !present {
					clientPerf[shortName] = ClientTiming{
						Duration: i,
						Name:     shortName,
					}
				} else {
					c.Duration = i - c.Start
					clientPerf[shortName] = c
				}
			}
		}
	}
	for _, v := range clientPerf {
		ct.Timings = append(ct.Timings, &ClientTiming{
			Name:     sentenceCase(v.Name),
			Start:    v.Start,
			Duration: v.Duration,
		})
	}
	sort.Sort(ct)

	return ct
}

func sentenceCase(s string) string {
	var buf bytes.Buffer
	for k, v := range s {
		if k == 0 {
			buf.WriteRune(unicode.ToUpper(v))
			continue
		}
		if unicode.IsUpper(v) {
			buf.WriteString(" ")
		}
		buf.WriteRune(v)
	}
	return buf.String()
}

func static(w http.ResponseWriter, r *http.Request) {
	fname := r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:]
	if v, present := staticFiles[fname]; present {
		h := w.Header()

		if strings.HasSuffix(r.URL.Path, ".css") {
			h.Set("Content-type", "text/css")
		} else if strings.HasSuffix(r.URL.Path, ".js") {
			h.Set("Content-type", "text/javascript")
		}

		h.Set("Cache-Control", "public, max-age=expiry")
		expires := time.Now().Add(time.Hour)
		h.Set("Expires", expires.Format(time.RFC1123))

		w.Write(v)
	}
}

// Includes renders the JavaScript includes for this request, if enabled.
func (p *Profile) Includes() template.HTML {
	if !Enable(p.r) {
		return ""
	}

	current := p.Id
	authorized := true

	v := map[string]interface{}{
		"ids":                 current,
		"path":                PATH,
		"version":             Version,
		"position":            Position,
		"showTrivial":         ShowTrivial,
		"showChildren":        ShowChildren,
		"maxTracesToShow":     MaxTracesToShow,
		"showControls":        ShowControls,
		"currentId":           current,
		"authorized":          authorized,
		"toggleShortcut":      ToggleShortcut,
		"startHidden":         StartHidden,
		"trivialMilliseconds": TrivialMilliseconds,
	}

	var w bytes.Buffer
	if err := includePartialHtmlTmpl.Execute(&w, v); err != nil {
		log.Print(err)
		return ""
	}
	return template.HTML(w.String())
}

type Handler struct {
	f func(Timer, http.ResponseWriter, *http.Request)
	p *Profile
}

// NewHandler returns a new profiled handler.
func NewHandler(f func(Timer, http.ResponseWriter, *http.Request)) Handler {
	return Handler{
		f: f,
	}
}

func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Query().Get("pp") {
	default:
		h.ProfileRequest(w, r)
	}
}

func (h Handler) ProfileRequest(w http.ResponseWriter, r *http.Request) {
	h.p = NewProfile(w, r, FuncName(h.f))
	h.f(h.p, w, r)
	h.p.Finalize()
}

// Since returns the number of milliseconds since t.
func Since(t time.Time) float64 {
	d := time.Since(t)
	return float64(d.Nanoseconds()) / 1000000
}

// Hostname returns the os.Hostname() of the current machine,
// or "" if unavailable.
func Hostname() string {
	name, err := os.Hostname()
	if err != nil {
		return ""
	}
	return name
}

// FuncName returns the name of the function f, or "" if f is not a function.
func FuncName(f interface{}) string {
	v := reflect.ValueOf(f)
	if v.Kind() != reflect.Func {
		return ""
	}
	fp := v.Pointer()
	if fn := runtime.FuncForPC(fp); fn != nil {
		return fn.Name()
	}
	return ""
}

// EnableAll returns true.
func EnableAll(r *http.Request) bool {
	return true
}

var profiles map[string]*Profile
var profileLock sync.Mutex

func init() {
	profiles = make(map[string]*Profile)
}

// StoreMemory stores a profile in memory (concurrent-safe). Note that profiles
// do not expire, so memory usage will increase until restart. This function is
// provided as an example: it is not designed for production use.
func StoreMemory(r *http.Request, p *Profile) {
	profileLock.Lock()
	defer profileLock.Unlock()
	profiles[string(p.Id)] = p
}

// GetMemory fetches a profile stored by StoreMemory (concurrent-safe).
func GetMemory(r *http.Request, id string) *Profile {
	profileLock.Lock()
	defer profileLock.Unlock()
	return profiles[id]
}

//go:generate esc -o static.go -pkg miniprofiler -prefix ../ui ../ui/include.partial.html ../ui/includes.css ../ui/includes.js ../ui/includes.tmpl ../ui/share.html
