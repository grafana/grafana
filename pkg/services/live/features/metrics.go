package features

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/models"
)

// Measurment is a single measurement value
type Measurment struct {
	Name   string                 `json:"name,omitempty"`
	Time   int64                  `json:"time,omitempty"` // units are usually ms, but depend on the channel
	Values map[string]interface{} `json:"values,omitempty"`
	Labels map[string]string      `json:"labels,omitempty"`
}

// MeasurmentReader reads the measurments
type MeasurmentReader func() []Measurment

type metricsRunner struct {
	publisher models.ChannelPublisher
	channel   string
	running   bool
	measure   MeasurmentReader
}

// MetricsSupplier manages all the `grafana/metrics/*` channels
type MetricsSupplier struct {
	publisher models.ChannelPublisher
	Node      *centrifuge.Node
}

// CreateMetricsSupplier Initialize a dashboard handler
func CreateMetricsSupplier(p models.ChannelPublisher, node *centrifuge.Node) MetricsSupplier {
	return MetricsSupplier{
		publisher: p,
		Node:      node,
	}
}

// GetHandlerForPath called on init
func (g *MetricsSupplier) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	channel := "grafana/metrics/" + path

	if path == "live" {
		return &metricsRunner{
			publisher: g.publisher,
			channel:   channel,
			measure: func() []Measurment {
				timestamp := time.Now().UnixNano() / int64(time.Millisecond)
				info, err := g.Node.Info()
				if err != nil {
					logger.Warn("error reading live values")
				}
				measures := make([]Measurment, len(info.Nodes))
				for _, node := range info.Nodes {
					m := Measurment{
						Name:   node.Name,
						Time:   timestamp,
						Values: make(map[string]interface{}),
						Labels: make(map[string]string),
					}
					if node.Version != "" {
						m.Labels["version"] = node.Version
					}
					// m.Labels["uid"] = node.UID
					m.Values["channels"] = node.NumChannels
					m.Values["clients"] = node.NumClients
					m.Values["users"] = node.NumUsers

					// // Internal metrics
					// if node.Metrics != nil {
					// 	for k, v := range node.Metrics.Items {
					// 		m.Values[k] = v
					// 	}
					// }

					measures = append(measures, m)
				}
				return measures
			},
		}, nil
	}

	return nil, fmt.Errorf("unknown channel")
}

// GetChannelOptions called fast and often
func (g *metricsRunner) GetChannelOptions(id string) centrifuge.ChannelOptions {
	return centrifuge.ChannelOptions{}
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (g *metricsRunner) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) error {
	if !g.running {
		g.running = true

		// Run in the background
		go g.runTimer()
	}

	// TODO? check authentication
	return nil
}

// OnPublish called when an event is received from the websocket
func (g *metricsRunner) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) ([]byte, error) {
	return nil, fmt.Errorf("can not publish to testdata")
}

// RunRandomCSV just for an example
func (g *metricsRunner) runTimer() {
	ticker := time.NewTicker(time.Duration(1) * time.Second)

	line := randomWalkMessage{}

	for t := range ticker.C {
		line.Time = t.UnixNano() / int64(time.Millisecond)
		m := g.measure()

		bytes, err := json.Marshal(&m)
		if err != nil {
			logger.Warn("unable to marshal line", "error", err)
			continue
		}

		err = g.publisher(g.channel, bytes)
		if err != nil {
			logger.Warn("write", "channel", g.channel, "line", line)
		}
	}
}
