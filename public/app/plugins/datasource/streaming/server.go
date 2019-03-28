package main

import (
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"time"
)

var counter int = 0

func main() {
	http.HandleFunc("/", handler)
	fmt.Println("Listening on port: 7777")
	if err := http.ListenAndServe(":7777", nil); err != nil {
		panic(err)
	}
}

func setupResponse(w *http.ResponseWriter, req *http.Request) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
	(*w).Header().Set("Access-Control-Allow-Methods", "GET")
	(*w).Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
}

func handler(w http.ResponseWriter, r *http.Request) {
	setupResponse(&w, r)
	if (*r).Method == "OPTIONS" {
		return
	}
	counter = counter + 1
	id := counter

	flusher, ok := w.(http.Flusher)
	if !ok {
		panic("expected http.ResponseWriter to be an http.Flusher")
	}

	w.Header().Set("Content-Type", "text/plain") // or csv

	speed := int64(1000)
	spread := float64(2.5)

	query := r.URL.Query()
	param := query.Get("speed")
	if param != "" {
		speed, _ = strconv.ParseInt(param, 10, 64)
	}
	param = query.Get("spread")
	if param != "" {
		spread, _ = strconv.ParseFloat(param, 64)
	}

	fmt.Printf("[%d] Got connection: %s (speed:%v, spread:%v)\n", id, r.URL, speed, spread)

	walker := rand.Float64() * 100
	ticker := time.NewTicker(time.Duration(speed) * time.Millisecond)

	// Keep writing writing until disconnected
	notify := w.(http.CloseNotifier).CloseNotify()
	go func() {
		<-notify
		fmt.Println("Connection Closed")
		ticker.Stop()
	}()

	fmt.Fprintf(w, "time,value,min,max,date\n")

	for t := range ticker.C {
		delta := rand.Float64() - 0.5
		walker += delta

		fmt.Printf("[%v] Tick: %v\n", id, walker)

		ms := t.UnixNano() / (int64(time.Millisecond) / int64(time.Nanosecond))

		fmt.Fprintf(w, "%v", ms)
		fmt.Fprintf(w, ",%.4f", walker)
		fmt.Fprintf(w, ",%.4f", walker-((rand.Float64()*spread)+0.01)) // min
		fmt.Fprintf(w, ",%.4f", walker+((rand.Float64()*spread)+0.01)) // max
		fmt.Fprintf(w, ",%s\n", t.Format(time.RFC3339Nano))
		flusher.Flush() // Trigger "chunked" encoding and send a chunk...
	}
}
