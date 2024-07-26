package main

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	opsProcessed := promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "fakedata_highcard_http_requests_total",
		Help: "a high cardinality counter",
	}, []string{"dimension"})

	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Hello, World!"))
	})

	go func() {
		for {
			for i := 0; i < 1000; i++ {
				opsProcessed.WithLabelValues("value_" + strconv.Itoa(i)).Inc()
			}

			time.Sleep(2 * time.Second)
		}
	}()

	log.Fatal(http.ListenAndServe(":3012", nil))
}
