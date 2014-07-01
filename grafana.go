package main

import (
	log "github.com/alecthomas/log4go"
	"github.com/torkelo/grafana-pro/backend/server"
	"os"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3838"
	}

	log.Info("Starting Grafana-Pro v.1-alpha")

	server, err := server.NewServer(port)
	if err != nil {
		time.Sleep(time.Second)
		panic(err)
	}

	err = server.ListenAndServe()
	if err != nil {
		log.Error("ListenAndServe failed: ", err)
	}

	time.Sleep(time.Millisecond * 2000)
}

/*	log.Println("Starting Grafana-Pro v.1-alpha, listening on port " + port)

	router := mux.NewRouter()
	router.HandleFunc("/", handler)
	router.HandleFunc("/api/dashboards/{id}", dashboardGet)
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./public/")))

	http.Handle("/", router)
	http.ListenAndServe(":"+port, nil)
}

func handler(w http.ResponseWriter, r *http.Request) {
	log.Println("GET /")

	view := template.New("viewTemplate")
	view.Delims("[[", "]]")

	t, err := view.ParseFiles("./views/index.html")
	if err != nil {
		log.Fatal(err)
	}

	t.ExecuteTemplate(w, "index.html", &IndexViewModel{Title: "hello from go"})
}

type DashboardModel struct {
	Title string `json:"title"`
}

func dashboardGet(res http.ResponseWriter, r *http.Request) {

	dashboard := &DashboardModel{
		Title: "hej från gå",
	}

	data, _ := json.Marshal(dashboard)
	res.Header().Set("Content-Type", "application/json; charset=utf-8")
	res.Write(data)
}
*/
