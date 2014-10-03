package api

import (
	"html/template"

	log "github.com/alecthomas/log4go"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/sessions"
	"github.com/torkelo/grafana-pro/pkg/components"
	"github.com/torkelo/grafana-pro/pkg/configuration"
	"github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/stores"
)

type HttpServer struct {
	port     string
	shutdown chan bool
	store    stores.Store
	renderer *components.PhantomRenderer
	router   *gin.Engine
	cfg      *configuration.Cfg
}

var sessionStore = sessions.NewCookieStore([]byte("something-very-secret"))

func NewHttpServer(cfg *configuration.Cfg, store stores.Store) *HttpServer {
	self := &HttpServer{}
	self.cfg = cfg
	self.port = cfg.Http.Port
	self.store = store
	self.renderer = &components.PhantomRenderer{ImagesDir: "data/png", PhantomDir: "_vendor/phantomjs"}

	return self
}

func (self *HttpServer) ListenAndServe() {
	log.Info("Starting Http Listener on port %v", self.port)
	defer func() { self.shutdown <- true }()

	self.router = gin.New()
	self.router.Use(gin.Recovery(), apiLogger(), CacheHeadersMiddleware())

	self.router.Static("/public", "./public")
	self.router.Static("/app", "./public/app")
	self.router.Static("/img", "./public/img")

	// register & parse templates
	templates := template.New("templates")
	templates.Delims("[[", "]]")
	templates.ParseFiles("./views/index.html")
	self.router.SetHTMLTemplate(templates)

	for _, fn := range routeHandlers {
		fn(self)
	}

	// register default route
	self.router.GET("/", self.auth(), self.index)
	self.router.GET("/dashboard/*_", self.auth(), self.index)
	self.router.GET("/admin/*_", self.auth(), self.index)
	self.router.GET("/account/*_", self.auth(), self.index)

	self.router.Run(":" + self.port)
}

func (self *HttpServer) index(c *gin.Context) {
	viewModel := &IndexDto{}
	userAccount, _ := c.Get("userAccount")
	account, _ := userAccount.(*models.Account)
	initCurrentUserDto(&viewModel.User, account)

	c.HTML(200, "index.html", viewModel)
}

func CacheHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Add("Cache-Control", "max-age=0, public, must-revalidate, proxy-revalidate")
	}
}
