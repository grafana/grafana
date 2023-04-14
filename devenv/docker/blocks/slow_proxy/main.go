package main

import (
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
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
		safeSleep := strings.ReplaceAll(sleep.String(), "\n", "")
		safeRequestUri := strings.ReplaceAll(r.RequestURI, "\n", "")
		log.Printf("sleeping for %s then proxying request: url '%s'", safeSleep, safeRequestUri)

		// This is commented out as CodeQL flags this as vulnerability CWE-117 (https://cwe.mitre.org/data/definitions/117.html)
		// If you need to debug and log the headers then use the line below instead of the log.Printf statement above
		// The docker container will then need to be rebuilt after the change is made:
		// Run `make devenv sources=slow_proxy`
		// or run `docker-compose build` in the devenv folder
		//
		// log.Printf("sleeping for %s then proxying request: url '%s', headers: '%v'", safeSleep, safeRequestUri, r.Header)
		<-time.After(sleep)
		proxy.ServeHTTP(w, r)
	})

	log.Fatal(http.ListenAndServe(":3011", nil))
}
