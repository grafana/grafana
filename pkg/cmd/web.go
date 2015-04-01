// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package cmd

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"

	"github.com/Unknwon/macaron"
	"github.com/codegangsta/cli"
	"github.com/macaron-contrib/session"
	_ "github.com/macaron-contrib/session/mysql"
	_ "github.com/macaron-contrib/session/postgres"
	_ "github.com/macaron-contrib/session/redis"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/static"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/eventpublisher"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/social"
)

var Web = cli.Command{
	Name:        "web",
	Usage:       "Starts Grafana backend & web server",
	Description: "Starts Grafana backend & web server",
	Action:      runWeb,
}

func newMacaron() *macaron.Macaron {
	macaron.Env = setting.Env

	m := macaron.New()
	m.Use(middleware.Logger())
	m.Use(macaron.Recovery())

	if setting.EnableGzip {
		m.Use(middleware.Gziper())
	}

	mapStatic(m, "", "public")
	mapStatic(m, "app", "app")
	mapStatic(m, "css", "css")
	mapStatic(m, "img", "img")
	mapStatic(m, "fonts", "fonts")

	m.Use(session.Sessioner(setting.SessionOptions))

	m.Use(macaron.Renderer(macaron.RenderOptions{
		Directory:  path.Join(setting.StaticRootPath, "views"),
		IndentJSON: macaron.Env != macaron.PROD,
		Delims:     macaron.Delims{Left: "[[", Right: "]]"},
	}))

	m.Use(middleware.GetContextHandler())
	return m
}

func mapStatic(m *macaron.Macaron, dir string, prefix string) {
	headers := func(c *macaron.Context) {
		c.Resp.Header().Set("Cache-Control", "public, max-age=3600")
	}

	if setting.Env == setting.DEV {
		headers = func(c *macaron.Context) {
			c.Resp.Header().Set("Cache-Control", "max-age=0, must-revalidate, no-cache")
		}
	}

	m.Use(httpstatic.Static(
		path.Join(setting.StaticRootPath, dir),
		httpstatic.StaticOptions{
			SkipLogging: true,
			Prefix:      prefix,
			AddHeaders:  headers,
		},
	))
}

func runWeb(c *cli.Context) {
	initRuntime(c)
	writePIDFile(c)

	social.NewOAuthService()
	eventpublisher.Init()
	plugins.Init()

	var err error
	m := newMacaron()
	api.Register(m)

	if setting.ReportingEnabled {
		go metrics.StartUsageReportLoop()
	}

	listenAddr := fmt.Sprintf("%s:%s", setting.HttpAddr, setting.HttpPort)
	log.Info("Listen: %v://%s%s", setting.Protocol, listenAddr, setting.AppSubUrl)
	switch setting.Protocol {
	case setting.HTTP:
		err = http.ListenAndServe(listenAddr, m)
	case setting.HTTPS:
		err = http.ListenAndServeTLS(listenAddr, setting.CertFile, setting.KeyFile, m)
	default:
		log.Fatal(4, "Invalid protocol: %s", setting.Protocol)
	}

	if err != nil {
		log.Fatal(4, "Fail to start server: %v", err)
	}
}

func writePIDFile(c *cli.Context) {
	path := c.GlobalString("pidfile")
	if path == "" {
		return
	}

	// Ensure the required directory structure exists.
	err := os.MkdirAll(filepath.Dir(path), 0700)
	if err != nil {
		log.Fatal(3, "Failed to verify pid directory", err)
	}

	// Retrieve the PID and write it.
	pid := strconv.Itoa(os.Getpid())
	if err := ioutil.WriteFile(path, []byte(pid), 0644); err != nil {
		log.Fatal(3, "Failed to write pidfile", err)
	}
}
