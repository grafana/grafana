package api

import (
	"html/template"

	log "github.com/alecthomas/log4go"
	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/backend/components"
	"github.com/torkelo/grafana-pro/backend/stores"
)

type HttpServer struct {
	port     string
	shutdown chan bool
	store    stores.Store
	renderer *components.PhantomRenderer
	router   *gin.Engine
}

func NewHttpServer(port string, store stores.Store) *HttpServer {
	self := &HttpServer{}
	self.port = port
	self.store = store
	self.renderer = &components.PhantomRenderer{ImagesDir: "data/png", PhantomDir: "_vendor/phantomjs"}

	return self
}

func CacheHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Add("Cache-Control", "max-age=0, public, must-revalidate, proxy-revalidate")
	}
}

func (self *HttpServer) ListenAndServe() {
	log.Info("Starting Http Listener on port %v", self.port)
	defer func() { self.shutdown <- true }()

	self.router = gin.Default()
	self.router.Use(CacheHeadersMiddleware())

	// register & parse templates
	templates := template.New("templates")
	templates.Delims("[[", "]]")
	templates.ParseFiles("./views/index.html")
	self.router.SetHTMLTemplate(templates)

	// register default route
	self.router.GET("/", self.index)
	for _, fn := range routeHandlers {
		fn(self)
	}

	self.router.Static("/public", "./public")
	self.router.Static("/app", "./public/app")
	self.router.Static("/img", "./public/img")

	self.router.Run(":" + self.port)
}

func (self *HttpServer) index(c *gin.Context) {
	c.HTML(200, "index.html", &indexViewModel{title: "hello from go"})
}

// Api Handler Registration
var routeHandlers = make([]routeHandlerRegisterFn, 0)

type routeHandlerRegisterFn func(self *HttpServer)

func addRoutes(fn routeHandlerRegisterFn) {
	routeHandlers = append(routeHandlers, fn)
}
