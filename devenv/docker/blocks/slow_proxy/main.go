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
		safeSleep := strings.Replace(sleep.String(), "\n", "", -1)
		safeRequestUri := strings.Replace(r.RequestURI, "\n", "", -1)
		safeHeader := getSafeHeader(r.Header)

		log.Printf("sleeping for %s then proxying request: url '%s', headers: '%v'", safeSleep, safeRequestUri, safeHeader)
		<-time.After(sleep)
		proxy.ServeHTTP(w, r)
	})

	log.Fatal(http.ListenAndServe(":3011", nil))
}

func getSafeHeader(header http.Header) map[string][]string {
	safeHeader := make(map[string][]string)
	for name, values := range header {
		safeName := strings.Replace(name, "\n", "", -1)
		for _, value := range values {
			if name == "Cookie" {
				safeHeader["Cookie"] = append(safeHeader["Cookie"], "**redacted**")
			} else {
				safeHeader[name] = append(safeHeader[safeName], strings.Replace(value, "\n", "", -1))
			}
		}
	}

	return safeHeader
}
