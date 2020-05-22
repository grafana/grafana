package api

import (
	"context"
	"crypto/tls"
	"fmt"
	"github.com/grafana/grafana/pkg/services/search"
	"net"
	"net/http"
	"os"
	"path"
	"sync"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"

	"github.com/grafana/grafana/pkg/api/live"
	"github.com/grafana/grafana/pkg/api/routing"
	httpstatic "github.com/grafana/grafana/pkg/api/static"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	macaron "gopkg.in/macaron.v1"
)

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "HTTPServer",
		Instance:     &HTTPServer{},
		InitPriority: registry.High,
	})
}

type HTTPServer struct {
	log           log.Logger
	macaron       *macaron.Macaron
	context       context.Context
	streamManager *live.StreamManager
	httpSrv       *http.Server

	RouteRegister        routing.RouteRegister            `inject:""`
	Bus                  bus.Bus                          `inject:""`
	RenderService        rendering.Service                `inject:""`
	Cfg                  *setting.Cfg                     `inject:""`
	HooksService         *hooks.HooksService              `inject:""`
	CacheService         *localcache.CacheService         `inject:""`
	DatasourceCache      datasources.CacheService         `inject:""`
	AuthTokenService     models.UserTokenService          `inject:""`
	QuotaService         *quota.QuotaService              `inject:""`
	RemoteCacheService   *remotecache.RemoteCache         `inject:""`
	ProvisioningService  provisioning.ProvisioningService `inject:""`
	Login                *login.LoginService              `inject:""`
	License              models.Licensing                 `inject:""`
	BackendPluginManager backendplugin.Manager            `inject:""`
	PluginManager        *plugins.PluginManager           `inject:""`
	SearchService        *search.SearchService            `inject:""`
}

func (hs *HTTPServer) Init() error {
	hs.log = log.New("http.server")

	hs.streamManager = live.NewStreamManager()
	hs.macaron = hs.newMacaron()
	hs.registerRoutes()

	return nil
}

func (hs *HTTPServer) Run(ctx context.Context) error {
	hs.context = ctx

	hs.applyRoutes()
	hs.streamManager.Run(ctx)

	hs.httpSrv = &http.Server{
		Addr:    fmt.Sprintf("%s:%s", setting.HttpAddr, setting.HttpPort),
		Handler: hs.macaron,
	}
	switch setting.Protocol {
	case setting.HTTP2:
		if err := hs.configureHttp2(); err != nil {
			return err
		}
	case setting.HTTPS:
		if err := hs.configureHttps(); err != nil {
			return err
		}
	}

	var listener net.Listener
	switch setting.Protocol {
	case setting.HTTP, setting.HTTPS, setting.HTTP2:
		var err error
		listener, err = net.Listen("tcp", hs.httpSrv.Addr)
		if err != nil {
			return errutil.Wrapf(err, "failed to open listener on address %s", hs.httpSrv.Addr)
		}
	case setting.SOCKET:
		var err error
		listener, err = net.ListenUnix("unix", &net.UnixAddr{Name: setting.SocketPath, Net: "unix"})
		if err != nil {
			return errutil.Wrapf(err, "failed to open listener for socket %s", setting.SocketPath)
		}

		// Make socket writable by group
		if err := os.Chmod(setting.SocketPath, 0660); err != nil {
			return errutil.Wrapf(err, "failed to change socket permissions")
		}
	default:
		hs.log.Error("Invalid protocol", "protocol", setting.Protocol)
		return fmt.Errorf("invalid protocol %q", setting.Protocol)
	}

	hs.log.Info("HTTP Server Listen", "address", listener.Addr().String(), "protocol",
		setting.Protocol, "subUrl", setting.AppSubUrl, "socket", setting.SocketPath)

	var wg sync.WaitGroup
	wg.Add(1)

	// handle http shutdown on server context done
	go func() {
		defer wg.Done()

		<-ctx.Done()
		if err := hs.httpSrv.Shutdown(context.Background()); err != nil {
			hs.log.Error("Failed to shutdown server", "error", err)
		}
	}()

	switch setting.Protocol {
	case setting.HTTP, setting.SOCKET:
		if err := hs.httpSrv.Serve(listener); err != nil {
			if err == http.ErrServerClosed {
				hs.log.Debug("server was shutdown gracefully")
				return nil
			}
			return err
		}
	case setting.HTTP2, setting.HTTPS:
		if err := hs.httpSrv.ServeTLS(listener, setting.CertFile, setting.KeyFile); err != nil {
			if err == http.ErrServerClosed {
				hs.log.Debug("server was shutdown gracefully")
				return nil
			}
			return err
		}
	default:
		panic(fmt.Sprintf("Unhandled protocol %q", setting.Protocol))
	}

	wg.Wait()

	return nil
}

func (hs *HTTPServer) configureHttps() error {
	if setting.CertFile == "" {
		return fmt.Errorf("cert_file cannot be empty when using HTTPS")
	}

	if setting.KeyFile == "" {
		return fmt.Errorf("cert_key cannot be empty when using HTTPS")
	}

	if _, err := os.Stat(setting.CertFile); os.IsNotExist(err) {
		return fmt.Errorf(`Cannot find SSL cert_file at %v`, setting.CertFile)
	}

	if _, err := os.Stat(setting.KeyFile); os.IsNotExist(err) {
		return fmt.Errorf(`Cannot find SSL key_file at %v`, setting.KeyFile)
	}

	tlsCfg := &tls.Config{
		MinVersion:               tls.VersionTLS12,
		PreferServerCipherSuites: true,
		CipherSuites: []uint16{
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA,
			tls.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA,
			tls.TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA,
			tls.TLS_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_RSA_WITH_AES_128_CBC_SHA,
			tls.TLS_RSA_WITH_AES_256_CBC_SHA,
		},
	}

	hs.httpSrv.TLSConfig = tlsCfg
	hs.httpSrv.TLSNextProto = make(map[string]func(*http.Server, *tls.Conn, http.Handler))

	return nil
}

func (hs *HTTPServer) configureHttp2() error {
	if setting.CertFile == "" {
		return fmt.Errorf("cert_file cannot be empty when using HTTP2")
	}

	if setting.KeyFile == "" {
		return fmt.Errorf("cert_key cannot be empty when using HTTP2")
	}

	if _, err := os.Stat(setting.CertFile); os.IsNotExist(err) {
		return fmt.Errorf(`Cannot find SSL cert_file at %v`, setting.CertFile)
	}

	if _, err := os.Stat(setting.KeyFile); os.IsNotExist(err) {
		return fmt.Errorf(`Cannot find SSL key_file at %v`, setting.KeyFile)
	}

	tlsCfg := &tls.Config{
		MinVersion:               tls.VersionTLS12,
		PreferServerCipherSuites: false,
		CipherSuites: []uint16{
			tls.TLS_CHACHA20_POLY1305_SHA256,
			tls.TLS_AES_128_GCM_SHA256,
			tls.TLS_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
		},
		NextProtos: []string{"h2", "http/1.1"},
	}

	hs.httpSrv.TLSConfig = tlsCfg

	return nil
}

func (hs *HTTPServer) newMacaron() *macaron.Macaron {
	macaron.Env = setting.Env
	m := macaron.New()

	// automatically set HEAD for every GET
	m.SetAutoHead(true)

	return m
}

func (hs *HTTPServer) applyRoutes() {
	// start with middlewares & static routes
	hs.addMiddlewaresAndStaticRoutes()
	// then add view routes & api routes
	hs.RouteRegister.Register(hs.macaron)
	// then custom app proxy routes
	hs.initAppPluginRoutes(hs.macaron)
	// lastly not found route
	hs.macaron.NotFound(hs.NotFoundHandler)
}

func (hs *HTTPServer) addMiddlewaresAndStaticRoutes() {
	m := hs.macaron

	m.Use(middleware.Logger())

	if setting.EnableGzip {
		m.Use(middleware.Gziper())
	}

	m.Use(middleware.Recovery())

	for _, route := range plugins.StaticRoutes {
		pluginRoute := path.Join("/public/plugins/", route.PluginId)
		hs.log.Debug("Plugins: Adding route", "route", pluginRoute, "dir", route.Directory)
		hs.mapStatic(m, route.Directory, "", pluginRoute)
	}

	hs.mapStatic(m, setting.StaticRootPath, "build", "public/build")
	hs.mapStatic(m, setting.StaticRootPath, "", "public")
	hs.mapStatic(m, setting.StaticRootPath, "robots.txt", "robots.txt")

	if setting.ImageUploadProvider == "local" {
		hs.mapStatic(m, hs.Cfg.ImagesDir, "", "/public/img/attachments")
	}

	m.Use(middleware.AddDefaultResponseHeaders())

	if setting.ServeFromSubPath && setting.AppSubUrl != "" {
		m.SetURLPrefix(setting.AppSubUrl)
	}

	m.Use(macaron.Renderer(macaron.RenderOptions{
		Directory:  path.Join(setting.StaticRootPath, "views"),
		IndentJSON: macaron.Env != macaron.PROD,
		Delims:     macaron.Delims{Left: "[[", Right: "]]"},
	}))

	m.Use(hs.healthHandler)
	m.Use(hs.metricsEndpoint)
	m.Use(middleware.GetContextHandler(
		hs.AuthTokenService,
		hs.RemoteCacheService,
		hs.RenderService,
	))
	m.Use(middleware.OrgRedirect())

	// needs to be after context handler
	if setting.EnforceDomain {
		m.Use(middleware.ValidateHostHeader(setting.Domain))
	}

	m.Use(middleware.HandleNoCacheHeader())
}

func (hs *HTTPServer) metricsEndpoint(ctx *macaron.Context) {
	if !hs.Cfg.MetricsEndpointEnabled {
		return
	}

	if ctx.Req.Method != http.MethodGet || ctx.Req.URL.Path != "/metrics" {
		return
	}

	if hs.metricsEndpointBasicAuthEnabled() && !BasicAuthenticatedRequest(ctx.Req, hs.Cfg.MetricsEndpointBasicAuthUsername, hs.Cfg.MetricsEndpointBasicAuthPassword) {
		ctx.Resp.WriteHeader(http.StatusUnauthorized)
		return
	}

	promhttp.
		HandlerFor(prometheus.DefaultGatherer, promhttp.HandlerOpts{}).
		ServeHTTP(ctx.Resp, ctx.Req.Request)
}

func (hs *HTTPServer) healthHandler(ctx *macaron.Context) {
	notHeadOrGet := ctx.Req.Method != http.MethodGet && ctx.Req.Method != http.MethodHead
	if notHeadOrGet || ctx.Req.URL.Path != "/api/health" {
		return
	}

	data := simplejson.New()
	data.Set("database", "ok")
	data.Set("version", setting.BuildVersion)
	data.Set("commit", setting.BuildCommit)

	if err := bus.Dispatch(&models.GetDBHealthQuery{}); err != nil {
		data.Set("database", "failing")
		ctx.Resp.Header().Set("Content-Type", "application/json; charset=UTF-8")
		ctx.Resp.WriteHeader(503)
	} else {
		ctx.Resp.Header().Set("Content-Type", "application/json; charset=UTF-8")
		ctx.Resp.WriteHeader(200)
	}

	dataBytes, _ := data.EncodePretty()
	if _, err := ctx.Resp.Write(dataBytes); err != nil {
		hs.log.Error("Failed to write to response", "err", err)
	}
}

func (hs *HTTPServer) mapStatic(m *macaron.Macaron, rootDir string, dir string, prefix string) {
	headers := func(c *macaron.Context) {
		c.Resp.Header().Set("Cache-Control", "public, max-age=3600")
	}

	if prefix == "public/build" {
		headers = func(c *macaron.Context) {
			c.Resp.Header().Set("Cache-Control", "public, max-age=31536000")
		}
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

func (hs *HTTPServer) metricsEndpointBasicAuthEnabled() bool {
	return hs.Cfg.MetricsEndpointBasicAuthUsername != "" && hs.Cfg.MetricsEndpointBasicAuthPassword != ""
}
