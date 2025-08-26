package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Event struct {
	Status            string    `json:"status"`
	TimeNow           time.Time `json:"timeNow"`
	StartsAt          time.Time `json:"startsAt"`
	Node              string    `json:"node"`
	DeltaLastSeconds  float64   `json:"deltaLastSeconds"`
	DeltaStartSeconds float64   `json:"deltaStartSeconds"`
}

type Notification struct {
	Alerts            []Alert           `json:"alerts"`
	CommonAnnotations map[string]string `json:"commonAnnotations"`
	CommonLabels      map[string]string `json:"commonLabels"`
	ExternalURL       string            `json:"externalURL"`
	GroupKey          string            `json:"groupKey"`
	GroupLabels       map[string]string `json:"groupLabels"`
	Message           string            `json:"message"`
	OrgID             int               `json:"orgId"`
	Receiver          string            `json:"receiver"`
	State             string            `json:"state"`
	Status            string            `json:"status"`
	Title             string            `json:"title"`
	TruncatedAlerts   int               `json:"truncatedAlerts"`
	Version           string            `json:"version"`
}

type Alert struct {
	Annotations  map[string]string `json:"annotations"`
	DashboardURL string            `json:"dashboardURL"`
	StartsAt     time.Time         `json:"startsAt"`
	EndsAt       time.Time         `json:"endsAt"`
	Fingerprint  string            `json:"fingerprint"`
	GeneratorURL string            `json:"generatorURL"`
	Labels       map[string]string `json:"labels"`
	PanelURL     string            `json:"panelURL"`
	SilenceURL   string            `json:"silenceURL"`
	Status       string            `json:"status"`
	ValueString  string            `json:"valueString"`
	Values       map[string]any    `json:"values"`
}

type NotificationHandler struct {
	startedAt time.Time
	stats     map[string]int
	hist      []Event
	m         sync.Mutex
}

func NewNotificationHandler() *NotificationHandler {
	return &NotificationHandler{
		startedAt: time.Now(),
		stats:     make(map[string]int),
		hist:      make([]Event, 0),
	}
}

func (ah *NotificationHandler) Notify(w http.ResponseWriter, r *http.Request) {
	b, err := io.ReadAll(r.Body)
	if err != nil {
		log.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	n := Notification{}
	if err := json.Unmarshal(b, &n); err != nil {
		log.Println(err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	log.Printf("got notification from: %s. a: %v", r.RemoteAddr, n)

	ah.m.Lock()
	defer ah.m.Unlock()

	addr := r.RemoteAddr
	if split := strings.Split(r.RemoteAddr, ":"); len(split) > 0 {
		addr = split[0]
	}

	a := n.Alerts[0]

	timeNow := time.Now()

	ah.stats[n.Status]++

	var d time.Duration
	if len(ah.hist) > 0 {
		last := ah.hist[len(ah.hist)-1]
		d = timeNow.Sub(last.TimeNow)
	}

	ah.hist = append(ah.hist, Event{
		Status:            n.Status,
		StartsAt:          a.StartsAt,
		TimeNow:           timeNow,
		Node:              addr,
		DeltaLastSeconds:  d.Seconds(),
		DeltaStartSeconds: timeNow.Sub(ah.startedAt).Seconds(),
	})
}

func (ah *NotificationHandler) GetNotifications(w http.ResponseWriter, _ *http.Request) {
	ah.m.Lock()
	defer ah.m.Unlock()
	w.Header().Set("Content-Type", "application/json")

	res, err := json.MarshalIndent(map[string]any{"stats": ah.stats, "history": ah.hist}, "", "\t")
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		//nolint:errcheck
		w.Write([]byte(`{"error":"failed to marshal alerts"}`))
		log.Printf("failed to marshal alerts: %v\n", err)
		return
	}

	log.Printf("requested current state\n%v\n", string(res))

	_, err = w.Write(res)
	if err != nil {
		log.Printf("failed to write response: %v\n", err)
	}
}

func main() {
	ah := NewNotificationHandler()

	http.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	http.HandleFunc("/notify", ah.Notify)
	http.HandleFunc("/notifications", ah.GetNotifications)

	log.Println("Listening")
	//nolint:errcheck
	http.ListenAndServe("0.0.0.0:8080", nil)
}
