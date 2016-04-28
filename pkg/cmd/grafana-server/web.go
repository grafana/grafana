// Copyright 2014 Unknwon
// Copyright 2014 Torkel Ödegaard

package main

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"path"
	"strings"
	"time"

	"gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/static"
	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/plugins"
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

	for _, route := range plugins.StaticRoutes {
		pluginRoute := path.Join("/public/plugins/", route.PluginId)
		log.Info("Plugins: Adding route %s -> %s", pluginRoute, route.Directory)
		mapStatic(m, route.Directory, "", pluginRoute)
	}

	mapStatic(m, setting.StaticRootPath, "", "public")
	mapStatic(m, setting.StaticRootPath, "robots.txt", "robots.txt")

	m.Use(macaron.Renderer(macaron.RenderOptions{
		Directory:  path.Join(setting.StaticRootPath, "views"),
		IndentJSON: macaron.Env != macaron.PROD,
		Delims:     macaron.Delims{Left: "[[", Right: "]]"},
	}))

	if setting.EnforceDomain {
		m.Use(middleware.ValidateHostHeader(setting.Domain))
	}

	m.Use(middleware.GetContextHandler())
	m.Use(middleware.Sessioner(&setting.SessionOptions))

	return m
}

func mapStatic(m *macaron.Macaron, rootDir string, dir string, prefix string) {
	headers := func(c *macaron.Context) {
		c.Resp.Header().Set("Cache-Control", "public, max-age=3600")
	}

	if setting.Env == setting.DEV {
		headers = func(c *macaron.Context) {
			c.Resp.Header().Set("Cache-Control", "max-age=0, must-revalidate, no-cache")
		}
	}

	m.Use(httpstatic.Static(
		path.Join(rootDir, dir),
		httpstatic.StaticOptions{
			SkipLogging: true,
			Prefix:      prefix,
			AddHeaders:  headers,
		},
	))
}

func StartServer() {

	var err error
	restart := make(chan struct{}, 1)
	restart <- struct{}{}
	first := true
	listenAddr := fmt.Sprintf("%s:%s", setting.HttpAddr, setting.HttpPort)
	log.Info("Listen: %v://%s%s", setting.Protocol, listenAddr, setting.AppSubUrl)
	l, err := net.Listen("tcp", listenAddr)
	if err != nil {
		log.Fatal(4, "Fail to start server: %v", err)
	}
	if !(setting.Protocol == setting.HTTP || setting.Protocol == setting.HTTPS) {
		log.Fatal(4, "Invalid protocol: %s", setting.Protocol)
	}
	for {
		select {
		case <-restart:
			if !first {
				log.Info("Restarting backend on %v://%s%s", setting.Protocol, listenAddr, setting.AppSubUrl)
				l.Close()
				//wait up to 1 second for the old socket to close
				timer := time.NewTimer(time.Second)
				pre := time.Now()
			CONNECT:
				for {
					select {
					case <-timer.C:
						log.Fatal(4, "Fail to start server: %v", err)
					default:
						l, err = net.Listen("tcp", listenAddr)
						if err == nil {
							log.Debug("took %f seconds to bind new socket.", time.Since(pre).Seconds())
							timer.Stop()
							break CONNECT
						}
					}
				}
			}
			first = false
			go func() {
				plugins.Init()
				m := newMacaron()
				api.Register(m, restart)
				srv := http.Server{
					Addr:    listenAddr,
					Handler: m,
				}

				switch setting.Protocol {
				case setting.HTTP:
					err = srv.Serve(tcpKeepAliveListener{l.(*net.TCPListener)})
				case setting.HTTPS:
					cert, err := tls.LoadX509KeyPair(setting.CertFile, setting.KeyFile)
					if err != nil {
						log.Fatal(4, "Fail to start server: %v", err)
					}
					srv.TLSConfig = &tls.Config{
						Certificates: []tls.Certificate{cert},
						NextProtos:   []string{"http/1.1"},
					}
					tlsListener := tls.NewListener(tcpKeepAliveListener{l.(*net.TCPListener)}, srv.TLSConfig)
					err = srv.Serve(tlsListener)
				}
				if err != nil && !strings.Contains(err.Error(), "use of closed network connection") {
					log.Fatal(4, "Fail to start server: %v", err)
				}
			}()
		default:
			break
		}
	}
}

// tcpKeepAliveListener sets TCP keep-alive timeouts on accepted
// connections. It's used by ListenAndServe and ListenAndServeTLS so
// dead TCP connections (e.g. closing laptop mid-download) eventually
// go away.
type tcpKeepAliveListener struct {
	*net.TCPListener
}

func (ln tcpKeepAliveListener) Accept() (c net.Conn, err error) {
	tc, err := ln.AcceptTCP()
	if err != nil {
		return
	}
	tc.SetKeepAlive(true)
	tc.SetKeepAlivePeriod(3 * time.Minute)
	return tc, nil
}
