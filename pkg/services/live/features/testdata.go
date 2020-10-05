package features

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// TestdataRunner manages all the `grafana/dashboard/*` channels
type testdataRunner struct {
	publisher   models.ChannelPublisher
	running     bool
	speedMillis int
	dropPercent float64
	channel     string
	name        string
}

// TestdataSupplier manages all the `grafana/testdata/*` channels
type TestdataSupplier struct {
	Publisher models.ChannelPublisher
}

// DoNamespaceHTTP called from the http api
func (g *TestdataSupplier) DoNamespaceHTTP(c *models.ReqContext) {
	c.JSON(400, util.DynMap{
		"Unsupportedd": "TestdataSupplier",
	})
}

// GetHandlerForPath called on init
func (g *TestdataSupplier) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	channel := "grafana/testdata/" + path

	if path == "random-2s-stream" {
		return &testdataRunner{
			publisher:   g.Publisher,
			running:     false,
			speedMillis: 2000,
			dropPercent: 0,
			channel:     channel,
			name:        path,
		}, nil
	}

	if path == "random-flakey-stream" {
		return &testdataRunner{
			publisher:   g.Publisher,
			running:     false,
			speedMillis: 400,
			dropPercent: .6,
			channel:     channel,
		}, nil
	}

	return nil, fmt.Errorf("unknown channel")
}

// GetChannelOptions called fast and often
func (g *testdataRunner) GetChannelOptions(id string) centrifuge.ChannelOptions {
	return centrifuge.ChannelOptions{}
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (g *testdataRunner) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) error {
	if !g.running {
		g.running = true

		// Run in the background
		go g.runRandomCSV()
	}

	// TODO? check authentication
	return nil
}

// OnPublish called when an event is received from the websocket
func (g *testdataRunner) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) ([]byte, error) {
	return nil, fmt.Errorf("can not publish to testdata")
}

// DoChannelHTTP called from the http api
func (g *testdataRunner) DoChannelHTTP(c *models.ReqContext, channel string) {
	c.JSON(400, util.DynMap{
		"Unsupportedd": channel,
	})
}

// RunRandomCSV just for an example
func (g *testdataRunner) runRandomCSV() {
	spread := 50.0

	walker := rand.Float64() * 100
	ticker := time.NewTicker(time.Duration(g.speedMillis) * time.Millisecond)

	measure := models.Measurement{
		Name:   g.name,
		Time:   0,
		Values: make(map[string]interface{}, 5),
	}
	msg := models.MeasurementMessage{
		Measures: []models.Measurement{measure},
	}

	for t := range ticker.C {
		if rand.Float64() <= g.dropPercent {
			continue
		}
		delta := rand.Float64() - 0.5
		walker += delta

		measure.Time = t.UnixNano() / int64(time.Millisecond)
		measure.Values["value"] = walker
		measure.Values["min"] = walker - ((rand.Float64() * spread) + 0.01)
		measure.Values["max"] = walker + ((rand.Float64() * spread) + 0.01)

		bytes, err := json.Marshal(&msg)
		if err != nil {
			logger.Warn("unable to marshal line", "error", err)
			continue
		}

		err = g.publisher(g.channel, bytes)
		if err != nil {
			logger.Warn("write", "channel", g.channel, "line", measure)
		}
	}
}
