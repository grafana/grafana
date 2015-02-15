// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package cmd

import (
	"fmt"
	"net/http"
	"path"
	"time"

	"github.com/Unknwon/macaron"
	"github.com/codegangsta/cli"
	"github.com/macaron-contrib/session"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/eventpublisher"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/social"
)

var Web = cli.Command{
	Name:        "web",
	Usage:       "grafana web",
	Description: "Starts Grafana backend & web server",
	Action:      runWeb,
}

func newMacaron() *macaron.Macaron {
	macaron.Env = setting.Env

	m := macaron.New()
	m.Use(middleware.Logger())
	m.Use(macaron.Recovery())
	if setting.EnableGzip {
		m.Use(macaron.Gziper())
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
	m.Use(macaron.Static(
		path.Join(setting.StaticRootPath, dir),
		macaron.StaticOptions{
			SkipLogging: true,
			Prefix:      prefix,
		},
	))
}

func runWeb(c *cli.Context) {
	log.Info("Starting Grafana")
	log.Info("Version: %v, Commit: %v, Build date: %v", setting.BuildVersion, setting.BuildCommit, time.Unix(setting.BuildStamp, 0))

	setting.NewConfigContext()
	social.NewOAuthService()
	sqlstore.NewEngine()
	sqlstore.EnsureAdminUser()
	eventpublisher.Init()

	var err error
	m := newMacaron()
	api.Register(m)

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
