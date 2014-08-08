package httpApi

import (
	"html/template"

	log "github.com/alecthomas/log4go"
	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/backend/models"
	"github.com/torkelo/grafana-pro/backend/stores"
)

type HttpServer struct {
	port     string
	shutdown chan bool
	store    stores.Store
}

func NewHttpServer(port string, store stores.Store) *HttpServer {
	self := &HttpServer{}
	self.port = port
	self.store = store

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

	r := gin.Default()
	r.Use(CacheHeadersMiddleware())

	templates := template.New("templates")
	templates.Delims("[[", "]]")
	templates.ParseFiles("./views/index.html")

	r.SetHTMLTemplate(templates)

	r.GET("/", self.index)
	r.GET("/api/dashboards/:id", self.getDashboard)
	r.GET("/api/search/", self.search)
	r.POST("/api/dashboard", self.postDashboard)

	r.Static("/public", "./public")
	r.Static("/app", "./public/app")
	r.Static("/img", "./public/img")

	r.Run(":" + self.port)
}

type IndexViewModel struct {
	Title string
}

func (self *HttpServer) index(c *gin.Context) {
	c.HTML(200, "index.html", &IndexViewModel{Title: "hello from go"})
}

type ErrorRsp struct {
	Message string `json:"message"`
}

func (self *HttpServer) getDashboard(c *gin.Context) {
	id := c.Params.ByName("id")

	dash, err := self.store.GetById(id)
	if err != nil {
		c.JSON(404, &ErrorRsp{Message: "Dashboard not found"})
		return
	}

	c.JSON(200, dash.Data)
}

func (self *HttpServer) search(c *gin.Context) {
	query := c.Params.ByName("q")

	results, err := self.store.Query(query)
	if err != nil {
		c.JSON(500, &ErrorRsp{Message: "Search error"})
		return
	}

	c.JSON(200, results)
}

func (self *HttpServer) postDashboard(c *gin.Context) {
	var command saveDashboardCommand

	if c.EnsureBody(&command) {
		err := self.store.Save(&models.Dashboard{Data: command.Dashboard})
		if err == nil {
			c.JSON(200, gin.H{"status": "saved"})
			return
		}
	}

	c.JSON(500, gin.H{"error": "bad request"})
}
