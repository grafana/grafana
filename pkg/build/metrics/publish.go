package metrics

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"
)

type payload struct {
	Name     string `json:"name"`
	Value    int    `json:"value"`
	Interval int    `json:"interval"`
	MType    string `json:"mtype"`
	Time     int64  `json:"time"`
}

// Publish publishes a set of metrics.
func Publish(metrics map[string]string, apiKey string) error {
	log.Println("Publishing metrics")

	t := time.Now().Unix()
	data := []payload{}
	for k, vS := range metrics {
		v, err := strconv.Atoi(vS)
		if err != nil {
			return fmt.Errorf("key %q has value on invalid format: %q", k, vS)
		}
		data = append(data, payload{
			Name:     k,
			Value:    v,
			Interval: 60,
			MType:    "gauge",
			Time:     t,
		})
	}

	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	if err := enc.Encode(data); err != nil {
		return err
	}

	log.Printf("Publishing metrics to https://<user>:<pass>@graphite-us-central1.grafana.net/metrics, JSON: %s",
		buf.String())

	u := fmt.Sprintf("https://6371:%s@graphite-us-central1.grafana.net/metrics", apiKey)

	//nolint:gosec
	resp, err := http.Post(u, "application/json", &buf)
	if err != nil {
		return fmt.Errorf("metrics publishing failed: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			log.Println("Error closing HTTP body", err)
		}
	}()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("metrics publishing failed with status code %d", resp.StatusCode)
	}

	log.Printf("Metrics successfully published")

	return nil
}
