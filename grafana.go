package main

import (
	"os"
	"time"

	log "github.com/alecthomas/log4go"
	"github.com/torkelo/grafana-pro/backend/server"
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
