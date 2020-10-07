package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"time"
)

func main() {
	origin := os.Getenv("ORIGIN_SERVER")
	if origin == "" {
		origin = "http://host.docker.internal:9090/"
	}

	sleep := time.Minute

	originURL, _ := url.Parse(origin)
	proxy := httputil.NewSingleHostReverseProxy(originURL)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("sleeping for %s then proxying request: %s", sleep.String(), r.RequestURI)
		<-time.After(sleep)
		proxy.ServeHTTP(w, r)
	})

	log.Fatal(http.ListenAndServe(":3011", nil))
}
