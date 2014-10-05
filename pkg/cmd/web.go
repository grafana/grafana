// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package cmd

import (
	"fmt"
	"net/http"
	"path"

	"github.com/Unknwon/macaron"
	"github.com/codegangsta/cli"

	"github.com/torkelo/grafana-pro/pkg/log"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	"github.com/torkelo/grafana-pro/pkg/routes"
	"github.com/torkelo/grafana-pro/pkg/setting"
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
	m.Use(macaron.Static(
		path.Join(setting.StaticRootPath, "public"),
		macaron.StaticOptions{
			SkipLogging: true,
			Prefix:      "public",
		},
	))
	m.Use(macaron.Static(
		path.Join(setting.StaticRootPath, "public/app"),
		macaron.StaticOptions{
			SkipLogging: true,
			Prefix:      "app",
		},
	))
	m.Use(macaron.Static(
		path.Join(setting.StaticRootPath, "public/img"),
		macaron.StaticOptions{
			SkipLogging: true,
			Prefix:      "img",
		},
	))

	m.Use(macaron.Renderer(macaron.RenderOptions{
		Directory:  path.Join(setting.StaticRootPath, "views"),
		IndentJSON: macaron.Env != macaron.PROD,
		Delims:     macaron.Delims{Left: "[[", Right: "]]"},
	}))

	m.Use(middleware.GetContextHandler())
	return m
}

func runWeb(*cli.Context) {
	setting.NewConfigContext()
	setting.InitServices()

	log.Info("Starting Grafana-Pro v.1-alpha")

	m := newMacaron()

	// index
	m.Get("/", routes.Index)

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
