// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package cmd

import (
	"fmt"
	"net/http"
	"path"
	"time"

	"github.com/Unknwon/macaron"
	"github.com/macaron-contrib/bindata"

	"github.com/grafana/grafana/bindata/app"
	"github.com/grafana/grafana/bindata/css"
	"github.com/grafana/grafana/bindata/fonts"
	"github.com/grafana/grafana/bindata/img"
	"github.com/grafana/grafana/bindata/public"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/setting"
)

func newMacaron() *macaron.Macaron {
	macaron.Env = setting.Env
	m := macaron.New()

	m.Use(middleware.Logger())
	m.Use(macaron.Recovery())

	if setting.EnableGzip {
		m.Use(middleware.Gziper())
	}

	//go:generate go-bindata -o bindata/public/main.go -pkg=public public/...
	mapStatic(m, "public", bindata.Options{
		Asset:      public.Asset,
		AssetDir:   public.AssetDir,
		AssetNames: public.AssetNames,
	})

	//go:generate go-bindata -o bindata/app/main.go -pkg=app -prefix=public public/app/...
	mapStatic(m, "app", bindata.Options{
		Asset:      app.Asset,
		AssetDir:   app.AssetDir,
		AssetNames: app.AssetNames,
	})

	//go:generate go-bindata -o bindata/css/main.go -pkg=css -prefix=public public/css/...
	mapStatic(m, "css", bindata.Options{
		Asset:      css.Asset,
		AssetDir:   css.AssetDir,
		AssetNames: css.AssetNames,
	})

	//go:generate go-bindata -o bindata/img/main.go -pkg=img -prefix=public public/img/...
	mapStatic(m, "img", bindata.Options{
		Asset:      img.Asset,
		AssetDir:   img.AssetDir,
		AssetNames: img.AssetNames,
	})

	//go:generate go-bindata -o bindata/fonts/main.go -pkg=fonts -prefix=public public/fonts/...
	mapStatic(m, "fonts", bindata.Options{
		Asset:      fonts.Asset,
		AssetDir:   fonts.AssetDir,
		AssetNames: fonts.AssetNames,
	})

	m.Use(macaron.Renderer(macaron.RenderOptions{
		Directory:  path.Join(setting.StaticRootPath, "views"),
		IndentJSON: macaron.Env != macaron.PROD,
		Delims:     macaron.Delims{Left: "[[", Right: "]]"},
	}))

	m.Use(middleware.GetContextHandler())
	m.Use(middleware.Sessioner(setting.SessionOptions))

	return m
}

func mapStatic(m *macaron.Macaron, prefix string, options bindata.Options) {
	headers := func() string {
		now := time.Now()
		if setting.Env != setting.DEV {
			now.Add(time.Duration(3600))
		}
		return now.Format(time.RFC1123)
	}

	m.Use(macaron.Static(prefix,
		macaron.StaticOptions{
			SkipLogging: true,
			Expires:     headers,
			FileSystem:  bindata.Static(options),
		},
	))
}

func StartServer() {

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
