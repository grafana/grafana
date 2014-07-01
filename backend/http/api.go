package http

import (
	"encoding/json"
	log "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"html/template"
	libhttp "net/http"
)

type HttpServer struct {
	port     string
	shutdown chan bool
}

func NewHttpServer(port string) *HttpServer {
	self := &HttpServer{}
	self.port = port
	return self
}

func (self *HttpServer) ListenAndServe() {
	log.Info("Starting Http Listener on port %v", self.port)

	defer func() { self.shutdown <- true }()

	router := mux.NewRouter()
	router.HandleFunc("/", self.index)
	router.HandleFunc("/api/dashboards/{id}", self.getDashboard)

	router.PathPrefix("/").Handler(libhttp.FileServer(libhttp.Dir("./public/")))

	libhttp.Handle("/", router)

	err := libhttp.ListenAndServe(":"+self.port, nil)
	if err != nil {
		log.Error("Listen: ", err)
	}
}

type IndexViewModel struct {
	Title string
}

func (self *HttpServer) index(res libhttp.ResponseWriter, r *libhttp.Request) {
	log.Debug("GET /")

	view := template.New("viewTemplate")
	view.Delims("[[", "]]")

	t, err := view.ParseFiles("./views/index.html")
	if err != nil {
		log.Exit(err)
	}

	t.ExecuteTemplate(res, "index.html", &IndexViewModel{Title: "hello from go"})
}

type DashboardModel struct {
	Title string `json:"title"`
}

func (self *HttpServer) getDashboard(res libhttp.ResponseWriter, r *libhttp.Request) {
	dashboard := &DashboardModel{
		Title: "hej från gå",
	}

	data, _ := json.Marshal(dashboard)
	res.Header().Set("Content-Type", "application/json; charset=utf-8")
	res.Write(data)
}
