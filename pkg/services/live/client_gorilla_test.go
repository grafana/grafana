package live_test

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

type config struct {
	origin   string // := "http://localhost/"
	url      string // := "ws://localhost:3000/api/live/push/custom_stream_xid"
	header   string //:= "Bearer glsa_L32PfpMkFzcYVwIWVRTChCXAzcGPcguU_10901b5a"
	interval time.Duration
}

func TestXWebsocket(t *testing.T) {
	//t.Skip()
	cfg := config{
		origin:   "http://localhost/",
		url:      "ws://localhost:3000/api/live/push/custom_stream_xid",
		header:   "Bearer glsa_hzRbIOlcWdyCKoEYiByKlzA1ZH8lA7Cp_0b8cdf58",
		interval: time.Second * 1,
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: 5 * time.Second,
	}

	headers := http.Header{}
	headers.Set("Authorization", cfg.header)

	conn, resp, err := dialer.Dial(cfg.url, headers)
	if err != nil {
		log.Fatalf("Error connecting to WebSocket server: %v", err)
	}
	defer conn.Close()
	defer resp.Body.Close()
	fmt.Printf("Connected to server with response: %+v", resp)

	go func() {
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				fmt.Printf("Error reading message: %v", err)
				return
			}
			fmt.Printf("Received: %s", string(message))
		}
	}()

	started := time.Now()
	for {
		t := rand.Float32() * 10
		influx := fmt.Sprintf("weather,location=us-midwest temperature=%f\n", t)
		err = conn.WriteMessage(websocket.TextMessage, []byte(influx))
		if err != nil {
			fmt.Printf("Error writing message: %v", err)
			break
		}
		fmt.Printf("send/Elapsed time: %s\n", time.Since(started))
		time.Sleep(cfg.interval)
	}
}
