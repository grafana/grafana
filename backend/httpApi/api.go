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

func NewHttpServer(port string) *HttpServer {
	self := &HttpServer{}
	self.port = port
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

type DashboardModel struct {
	Title string `json:"title"`
}

func (self *HttpServer) getDashboard(c *gin.Context) {
	dashboard := &DashboardModel{
		Title: "hej från gå",
	}

	c.JSON(200, dashboard)
}
