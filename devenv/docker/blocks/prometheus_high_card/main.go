package main

import (
	"fmt"
	"log"
	"math/rand/v2"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func randomValues(max int) func() (string, bool) {
	i := 0
	return func() (string, bool) {
		i++
		return strconv.Itoa(i), i < max+1
	}
}

func staticList(input []string) func() string {
	return func() string {
		i := rand.IntN(len(input))

		return input[i]
	}
}

type dimension struct {
	label        string
	getNextValue func() string
}

func main() {

	fakeMetrics := []dimension{
		{
			label:        "cluster",
			getNextValue: staticList([]string{"prod-uk1", "prod-eu1", "prod-uk2", "prod-eu2", "prod-uk3", "prod-eu3", "prod-uk4", "prod-eu4", "prod-uk5", "prod-eu5"}),
		},
		{
			label:        "namespace",
			getNextValue: staticList([]string{"default", "kube-api", "kube-system", "kube-public", "kube-node-lease", "kube-ingress", "kube-logging", "kube-metrics", "kube-monitoring", "kube-network", "kube-storage"}),
		},
		{
			label:        "pod",
			getNextValue: staticList([]string{"default"}),
		},
		{
			label:        "container",
			getNextValue: staticList([]string{"container"}),
		},
		{
			label:        "method",
			getNextValue: staticList([]string{"GET", "POST", "DELETE", "PUT", "PATCH"}),
		},
		{
			label:        "address",
			getNextValue: staticList([]string{"/", "/api", "/api/dashboard", "/api/dashboard/:uid", "/api/dashboard/:uid/overview", "/api/dashboard/:uid/overview/:id", "/api/dashboard/:uid/overview/:id/summary", "/api/dashboard/:uid/overview/:id/summary/:type", "/api/dashboard/:uid/overview/:id/summary/:type/:subtype", "/api/dashboard/:uid/overview/:id/summary/:type/:subtype/:id"}),
		},
		{
			label:        "extra_label_name1",
			getNextValue: staticList([]string{"default"}),
		},
		{
			label:        "extra_label_name2",
			getNextValue: staticList([]string{"default"}),
		},
		{
			label:        "extra_label_name3",
			getNextValue: staticList([]string{"default"}),
		},
		{
			label:        "extra_label_name4",
			getNextValue: staticList([]string{"default"}),
		},
		{
			label:        "extra_label_name5",
			getNextValue: staticList([]string{"default"}),
		},
		{
			label:        "extra_label_name6",
			getNextValue: staticList([]string{"default"}),
		},
	}

	dimensions := []string{}
	for _, dim := range fakeMetrics {
		dimensions = append(dimensions, dim.label)
	}

	opsProcessed := promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "fakedata_highcard_http_requests_total",
		Help: "a high cardinality counter",
	}, dimensions)

	// Models k8s pod recycle for TimeComparison high-cardinality pairing (#126181):
	// keep a few active pods and retire the oldest on a fixed cadence, so two overlapping
	// compare windows genuinely return a DIFFERENT set of pod series.
	podChurn := promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "fakedata_pod_churn_requests_total",
		Help: "request counter with rotating pod labels (simulates restarts)",
	}, []string{"pod"})

	http.Handle("/metrics", promhttp.Handler())
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Hello, is it me you're looking for?"))
	})

	go func() {
		for {
			labels := []string{}
			for _, dim := range fakeMetrics {
				value := dim.getNextValue()
				labels = append(labels, value)
			}

			opsProcessed.WithLabelValues(labels...).Inc()

			time.Sleep(time.Millisecond)
		}
	}()

	go runPodChurn(podChurn)

	fmt.Printf("Server started at :9111\n")

	log.Fatal(http.ListenAndServe(":9111", nil))
}

func runPodChurn(podChurn *prometheus.CounterVec) {
	const activeCount = 4                // pods alive at any moment (legend stays small)
	const rotateEvery = 30 * time.Second // retire oldest / add new on this cadence

	var mu sync.Mutex
	nextID := 1
	active := make([]string, 0, activeCount)
	// Per-pod increment rate so lines are visually distinct.
	rate := map[string]int{}

	rotate := func() {
		mu.Lock()
		defer mu.Unlock()

		if len(active) >= activeCount {
			old := active[0]
			active = active[1:]
			delete(rate, old)
			podChurn.DeleteLabelValues(old)
		}

		name := fmt.Sprintf("pod-%d", nextID)
		nextID++
		active = append(active, name)
		rate[name] = 1 + rand.IntN(5)
		podChurn.WithLabelValues(name).Add(float64(rate[name]))
	}

	for i := 0; i < activeCount; i++ {
		rotate()
	}

	go func() {
		t := time.NewTicker(rotateEvery)
		defer t.Stop()
		for range t.C {
			rotate()
		}
	}()

	for {
		mu.Lock()
		snapshot := make(map[string]int, len(active))
		for _, pod := range active {
			snapshot[pod] = rate[pod]
		}
		mu.Unlock()

		for pod, r := range snapshot {
			podChurn.WithLabelValues(pod).Add(float64(r))
		}
		time.Sleep(100 * time.Millisecond)
	}
}
