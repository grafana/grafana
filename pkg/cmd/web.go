// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package cmd

import (
	"fmt"
	"net/http"
	"path"

	"github.com/Unknwon/macaron"
	"github.com/codegangsta/cli"
	"github.com/macaron-contrib/session"

	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/routes"
	"github.com/torkelo/grafana-pro/pkg/setting"
	"github.com/torkelo/grafana-pro/pkg/social"
	"github.com/torkelo/grafana-pro/pkg/stores/sqlstore"
)

var CmdWeb = cli.Command{
	Name:        "web",
	Usage:       "Start Grafana Pro web server",
	Description: `Start Grafana Pro server`,
	Action:      runWeb,
	Flags:       []cli.Flag{},
}

func newMacaron() *macaron.Macaron {
	m := macaron.New()
	m.Use(middleware.Logger())
	m.Use(macaron.Recovery())

	mapStatic(m, "public", "public")
	mapStatic(m, "public/app", "app")
	mapStatic(m, "public/img", "img")

	m.Use(session.Sessioner(session.Options{
		Provider: setting.SessionProvider,
		Config:   *setting.SessionConfig,
	}))

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

func runWeb(*cli.Context) {
	setting.NewConfigContext()
	setting.InitServices()
	sqlstore.Init()
	social.NewOAuthService()

	// init database
	sqlstore.LoadModelsConfig()
	if err := sqlstore.NewEngine(); err != nil {
		log.Fatal(4, "fail to initialize orm engine: %v", err)
	}

	log.Info("Starting Grafana-Pro v.1-alpha")

	m := newMacaron()
	routes.Register(m)

	var err error
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
