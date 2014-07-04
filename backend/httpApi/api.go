package httpApi

import (
	log "github.com/alecthomas/log4go"
	"github.com/gin-gonic/gin"
	"github.com/torkelo/grafana-pro/backend/stores"
	"html/template"
	"net/http"
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

func (self *HttpServer) ListenAndServe() {
	log.Info("Starting Http Listener on port %v", self.port)

	defer func() { self.shutdown <- true }()

	r := gin.Default()
	r.HTMLTemplates = template.New("templates")
	r.HTMLTemplates.Delims("[[", "]]")
	r.HTMLTemplates.ParseFiles("./views/index.html")

	r.GET("/", self.index)
	r.GET("/api/dashboards/:id", self.getDashboard)
	r.ServeFiles("/public/*filepath", http.Dir("./public"))
	r.ServeFiles("/app/*filepath", http.Dir("./public/app"))
	r.ServeFiles("/img/*filepath", http.Dir("./public/img"))

	err := http.ListenAndServe(":"+self.port, r)
	if err != nil {
		log.Error("Listen: ", err)
	}
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
	}

	c.JSON(200, dash.Data)
}
