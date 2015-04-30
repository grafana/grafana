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
	"encoding/json"
	"fmt"
	"html/template"
	"math/rand"
	"net/http"
	"runtime/debug"
	"strings"
	"sync"
	"time"
)

var rnd = rand.New(&lockedSource{src: rand.NewSource(time.Now().UnixNano())})

type lockedSource struct {
	lk  sync.Mutex
	src rand.Source
}

func (r *lockedSource) Int63() (n int64) {
	r.lk.Lock()
	n = r.src.Int63()
	r.lk.Unlock()
	return
}

func (r *lockedSource) Seed(seed int64) {
	r.lk.Lock()
	r.src.Seed(seed)
	r.lk.Unlock()
}

func newGuid() string {
	return fmt.Sprintf("%016x", rnd.Int63())
}

type Profile struct {
	Id                   string
	Name                 string
	start                time.Time
	Started              int64
	MachineName          string
	Root                 *Timing
	ClientTimings        *ClientTimings
	DurationMilliseconds float64
	CustomLinks          map[string]string

	w http.ResponseWriter
	r *http.Request
}

type Timing struct {
	Id                   string
	Name                 string
	DurationMilliseconds float64
	StartMilliseconds    float64
	Children             []*Timing
	CustomTimings        map[string][]*CustomTiming

	profile *Profile
	sync.Mutex
}

// NewProfile creates a new Profile with given name.
// For use only by miniprofiler extensions.
func NewProfile(w http.ResponseWriter, r *http.Request, name string) *Profile {
	p := &Profile{
		w: w,
		r: r,
	}

	if Enable(r) {
		p.Id = newGuid()
		p.Name = name
		p.CustomLinks = make(map[string]string)
		p.start = time.Now()
		p.MachineName = MachineName()
		p.Root = &Timing{
			Id:      newGuid(),
			profile: p,
		}
		w.Header().Add("X-MiniProfiler-Ids", "[\""+p.Id+"\"]")
	}

	return p
}

// Finalize finalizes a Profile and Store()s it.
// For use only by miniprofiler extensions.
func (p *Profile) Finalize() {
	if p.Root == nil {
		return
	}

	u := p.r.URL
	if !u.IsAbs() {
		u.Host = p.r.Host
		if p.r.TLS == nil {
			u.Scheme = "http"
		} else {
			u.Scheme = "https"
		}
	}
	p.Root.Name = p.r.Method + " " + u.String()

	p.Started = p.start.Unix() * 1000
	p.DurationMilliseconds = Since(p.start)
	p.Root.DurationMilliseconds = p.DurationMilliseconds

	Store(p.r, p)
}

// ProfileFromJson returns a Profile from JSON data.
func ProfileFromJson(b []byte) *Profile {
	p := Profile{}
	json.Unmarshal(b, &p)
	return &p
}

// Json converts a profile to JSON.
func (p *Profile) Json() []byte {
	b, _ := json.Marshal(p)
	return b
}

type Timer interface {
	AddCustomTiming(callType, executeType string, start, end time.Time, command string)
	Step(name string, f func(t Timer))
	StepCustomTiming(callType, executeType, command string, f func())
	AddCustomLink(name, URL string)
	SetName(string)
	Includes() template.HTML
}

func (p *Profile) SetName(name string) {
	if p.Root != nil {
		p.Name = name
	}
}

func (T *Timing) SetName(name string) {
	if T != nil {
		T.profile.SetName(name)
	}
}

func (p *Profile) AddCustomLink(name, URL string) {
	if p.CustomLinks != nil {
		p.CustomLinks[name] = URL
	}
}

func (T *Timing) AddCustomLink(name, URL string) {
	if T != nil {
		T.profile.AddCustomLink(name, URL)
	}
}

func (p *Profile) AddCustomTiming(callType, executeType string, start, end time.Time, command string) {
	if p.Root != nil {
		p.Root.AddCustomTiming(callType, executeType, start, end, command)
	}
}

func (p *Profile) StepCustomTiming(callType, executeType, command string, f func()) {
	if p.Root != nil {
		p.Root.StepCustomTiming(callType, executeType, command, f)
	} else {
		f()
	}
}

func (p *Profile) Step(name string, f func(t Timer)) {
	if p.Root != nil {
		p.Root.Step(name, f)
	} else {
		f(p)
	}
}

func (T *Timing) Includes() template.HTML {
	if T != nil {
		return T.profile.Includes()
	}
	return ""
}

func (T *Timing) Step(name string, f func(t Timer)) {
	t := &Timing{
		Id:                newGuid(),
		Name:              name,
		StartMilliseconds: Since(T.profile.start),
		profile:           T.profile,
	}
	T.addChild(t)
	f(t)
	t.DurationMilliseconds = Since(t.profile.start) - t.StartMilliseconds
}

func (T *Timing) addChild(t *Timing) {
	T.Lock()
	T.Children = append(T.Children, t)
	T.Unlock()
}

func (t *Timing) AddCustomTiming(callType, executeType string, start, end time.Time, command string) {
	if t == nil {
		return
	}
	t.Lock()
	if t.CustomTimings == nil {
		t.CustomTimings = make(map[string][]*CustomTiming)
	}
	s := &CustomTiming{
		Id:                   newGuid(),
		StartMilliseconds:    start.Sub(t.profile.start).Seconds() * 1000,
		DurationMilliseconds: end.Sub(start).Seconds() * 1000,
		CommandString:        command,
		StackTraceSnippet:    getStackSnippet(),
		ExecuteType:          executeType,
	}
	t.CustomTimings[callType] = append(t.CustomTimings[callType], s)
	t.Unlock()
}

func (t *Timing) StepCustomTiming(callType, executeType, command string, f func()) {
	start := time.Now()
	f()
	end := time.Now()
	t.AddCustomTiming(callType, executeType, start, end, command)
}

func getStackSnippet() string {
	stack := debug.Stack()
	lines := strings.Split(string(stack), "\n")
	var snippet []string
	for i := 0; i < len(lines); i++ {
		idx := strings.LastIndex(lines[i], " ")
		if idx == -1 {
			break
		}

		if i+1 < len(lines) && strings.HasPrefix(lines[i+1], "\t") {
			i++
			snip := strings.TrimSpace(lines[i])
			snip = strings.Split(snip, ":")[0]
			sp := strings.Split(snip, ".")
			snip = sp[len(sp)-1]
			if strings.Contains(snip, "miniprofiler") || strings.HasPrefix(snip, "_func_") || snip == "ServeHTTP" || snip == "ProfileRequest" {
				continue
			}
			snippet = append(snippet, snip)
		}
	}
	if len(snippet) > 2 {
		snippet = snippet[2:]
	}
	return strings.Join(snippet, " ")
}

type CustomTiming struct {
	Id                             string
	ExecuteType                    string
	CommandString                  string
	StackTraceSnippet              string
	StartMilliseconds              float64
	DurationMilliseconds           float64
	FirstFetchDurationMilliseconds float64
}

type ClientTimings struct {
	RedirectCount int64
	Timings       []*ClientTiming
}

func (c *ClientTimings) Len() int           { return len(c.Timings) }
func (c *ClientTimings) Less(i, j int) bool { return c.Timings[i].Start < c.Timings[j].Start }
func (c *ClientTimings) Swap(i, j int)      { c.Timings[i], c.Timings[j] = c.Timings[j], c.Timings[i] }

type ClientTiming struct {
	Name     string
	Start    int64
	Duration int64
}
