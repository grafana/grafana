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

// Package toolbox is a middleware that provides health check, pprof, profile and statistic services for Macaron.
package toolbox

import (
	"fmt"
	"io"
	"net/http/pprof"
	"path"
	"time"

	"github.com/Unknwon/macaron"
)

// Toolbox represents a tool box service for Macaron instance.
type Toolbox interface {
	AddHealthCheck(string, HealthChecker)
	AddHealthCheckFunc(string, HealthCheckFunc)
	AddStatistics(string, string, time.Duration)
	GetMap(io.Writer)
}

type toolbox struct {
	*UrlMap
	healthCheckJobs []*healthCheck
}

// Options represents a struct for specifying configuration options for the Toolbox middleware.
type Options struct {
	// URL prefix for toolbox dashboard. Default is "/debug".
	URLPrefix string
	// URL for health check request. Default is "/healthcheck".
	HealthCheckURL string
	// Health checkers.
	HealthCheckers []HealthChecker
	// Health check functions.
	HealthCheckFuncs []*HealthCheckFuncDesc
	// URL prefix of pprof. Default is "/debug/pprof/".
	PprofURLPrefix string
	// URL prefix of profile. Default is "/debug/profile/".
	ProfileURLPrefix string
	// Path store profile files. Default is "profile".
	ProfilePath string
}

var opt Options

func prepareOptions(options []Options) {
	if len(options) > 0 {
		opt = options[0]
	}

	// Defaults.
	if len(opt.URLPrefix) == 0 {
		opt.URLPrefix = "/debug"
	}
	if len(opt.HealthCheckURL) == 0 {
		opt.HealthCheckURL = "/healthcheck"
	}
	if len(opt.PprofURLPrefix) == 0 {
		opt.PprofURLPrefix = "/debug/pprof/"
	} else if opt.PprofURLPrefix[len(opt.PprofURLPrefix)-1] != '/' {
		opt.PprofURLPrefix += "/"
	}
	if len(opt.ProfileURLPrefix) == 0 {
		opt.ProfileURLPrefix = "/debug/profile/"
	} else if opt.ProfileURLPrefix[len(opt.ProfileURLPrefix)-1] != '/' {
		opt.ProfileURLPrefix += "/"
	}
	if len(opt.ProfilePath) == 0 {
		opt.ProfilePath = path.Join(macaron.Root, "profile")
	}
}

func dashboard(ctx *macaron.Context) string {
	return fmt.Sprintf(`<p>Toolbox Index:</p>
	<ol>
	    <li><a href="%s">Pprof Information</a></li>
        <li><a href="%s">Profile Operations</a></li>
	</ol>`, opt.PprofURLPrefix, opt.ProfileURLPrefix)
}

// Toolboxer is a middleware provides health check, pprof, profile and statistic services for your application.
func Toolboxer(m *macaron.Macaron, options ...Options) macaron.Handler {
	prepareOptions(options)
	t := &toolbox{
		healthCheckJobs: make([]*healthCheck, 0, len(opt.HealthCheckers)+len(opt.HealthCheckFuncs)),
	}

	// Dashboard.
	m.Get(opt.URLPrefix, dashboard)

	// Health check.
	for _, hc := range opt.HealthCheckers {
		t.AddHealthCheck(hc)
	}
	for _, fd := range opt.HealthCheckFuncs {
		t.AddHealthCheckFunc(fd.Desc, fd.Func)
	}
	m.Get(opt.HealthCheckURL, t.handleHealthCheck)

	// Pprof.
	m.Any(path.Join(opt.PprofURLPrefix, "cmdline"), pprof.Cmdline)
	m.Any(path.Join(opt.PprofURLPrefix, "profile"), pprof.Profile)
	m.Any(path.Join(opt.PprofURLPrefix, "symbol"), pprof.Symbol)
	m.Any(opt.PprofURLPrefix, pprof.Index)
	m.Any(path.Join(opt.PprofURLPrefix, "*"), pprof.Index)

	// Profile.
	profilePath = opt.ProfilePath
	m.Get(opt.ProfileURLPrefix, handleProfile)

	// Routes statistic.
	t.UrlMap = &UrlMap{
		urlmap: make(map[string]map[string]*Statistics),
	}

	return func(ctx *macaron.Context) {
		ctx.MapTo(t, (*Toolbox)(nil))
	}
}
