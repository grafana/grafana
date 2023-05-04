package live_test

import (
	"fmt"
	"log"
	"math/rand"
	"testing"
	"time"

	"golang.org/x/net/websocket"
)

// Configure vscode settings with:
// "go.testFlags": ["-v"]
// See: https://github.com/Microsoft/vscode-go/issues/1377
func TestGorilla(t *testing.T) {
	//	t.Skip()

	cfg := config{
		origin:   "http://localhost/",
		url:      "ws://localhost:3000/api/live/push/custom_stream_xid",
		header:   "Bearer glsa_hzRbIOlcWdyCKoEYiByKlzA1ZH8lA7Cp_0b8cdf58",
		interval: time.Second * 1,
	}
	fmt.Println("running gorilla test: " + cfg.url)

	config, err := websocket.NewConfig(cfg.url, cfg.origin)
	if err != nil {
		log.Fatal(err)
	}

	config.Header.Add("Authorization", cfg.header)

	ws, err := websocket.DialConfig(config)
	if err != nil {
		log.Fatal(err)
	}

	go handleWebsocket(ws)

	t0 := time.Now()

	for {
		t1 := time.Now()
		fmt.Printf("send/Elapsed time: %v\n", t1.Sub(t0))
		t := rand.Float32() * 10
		influx := fmt.Sprintf("weather,location=us-midwest temperature=%f\n", t)
		if _, err := ws.Write([]byte(influx)); err != nil {
			log.Fatal(err)
		}
		time.Sleep(cfg.interval)
	}
}

func handleWebsocket(ws *websocket.Conn) {
	for {
		var msg string
		err := websocket.Message.Receive(ws, &msg)
		if err != nil {
			break
		}
	}
}
