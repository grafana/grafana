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
		log.Fatalf("ORIGIN_SERVER env-variable missing")
	}

	sleepStr := os.Getenv("SLEEP_DURATION")
	if sleepStr == "" {
		log.Fatalf("SLEEP_DURATION env-variable missing")
	}

	sleep, err := time.ParseDuration(sleepStr)
	if err != nil {
		log.Fatalf("Invalid SLEEP_DURATION env-variable: %v", err)
	}

	originURL, _ := url.Parse(origin)
	proxy := httputil.NewSingleHostReverseProxy(originURL)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Printf("sleeping for %s then proxying request: %s", sleep.String(), r.RequestURI)
		<-time.After(sleep)
		proxy.ServeHTTP(w, r)
	})

	log.Fatal(http.ListenAndServe(":8096", nil))
}
