package e2eutil

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

const timeout = 60

type GrafanaServer struct {
	Port int
	Host string
}

func Server(host string, port int) *GrafanaServer {
	return &GrafanaServer{
		Host: host,
		Port: port,
	}
}

func (g *GrafanaServer) Wait() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	timeoutExceeded := time.After(timeout * time.Second)

	for {
		select {
		case <-timeoutExceeded:
			log.Printf("grafana server failed to start after %d second(s) timeout", timeout)
			os.Exit(1)

		case <-ticker.C:
			url := fmt.Sprintf("http://%s:%d", g.Host, g.Port)
			//nolint:gosec
			resp, err := http.Get(url)
			if err == nil {
				body, err := io.ReadAll(resp.Body)
				if err != nil {
					log.Printf("failed to read response body: %q", err)
					return
				}
				log.Println("connected to grafana-server!")
				if resp.StatusCode < 200 || resp.StatusCode >= 300 {
					log.Printf("status code: %d, body: %s, exiting...", resp.StatusCode, string(body))
					os.Exit(1)
				}
				err = resp.Body.Close()
				if err != nil {
					log.Printf("error closing response body, body: %s", string(body))
					return
				}
				return
			}
			log.Printf("failed attempt to connect to grafana-server on url %s, retrying...", url)
		}
	}
}
