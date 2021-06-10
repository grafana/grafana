package main

import (
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
		// it is never not-set, the default is in the `.env` file
		log.Fatalf("missing env-variable ORIGIN_SERVER")
	}

	sleepDurationStr := os.Getenv("SLEEP_DURATION")
	if sleepDurationStr == "" {
		// it is never not-set, the default is in the `.env` file
		log.Fatalf("missing env-variable SLEEP_DURATION")
	}

	sleep, err := time.ParseDuration(sleepDurationStr)
	if err != nil {
		log.Fatalf("failed to parse SLEEP_DURATION: %v", err)
	}

	originURL, _ := url.Parse(origin)
	proxy := httputil.NewSingleHostReverseProxy(originURL)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("sleeping for %s then proxying request: url '%s', headers: '%v'", sleep.String(), r.RequestURI, r.Header)
		<-time.After(sleep)
		proxy.ServeHTTP(w, r)
	})

	log.Fatal(http.ListenAndServe(":3011", nil))
}
