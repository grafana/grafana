package features

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/models"
)

// testDataRunner manages all the `grafana/dashboard/*` channels.
type testDataRunner struct {
	publisher   models.ChannelPublisher
	running     bool
	speedMillis int
	dropPercent float64
	channel     string
	name        string
}

// TestDataSupplier manages all the `grafana/testdata/*` channels.
type TestDataSupplier struct {
	Publisher models.ChannelPublisher
}

// GetHandlerForPath gets the channel handler for a path.
// Called on init.
func (s *TestDataSupplier) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	channel := "grafana/testdata/" + path

	if path == "random-2s-stream" {
		return &testDataRunner{
			publisher:   s.Publisher,
			running:     false,
			speedMillis: 2000,
			dropPercent: 0,
			channel:     channel,
			name:        path,
		}, nil
	}

	if path == "random-flakey-stream" {
		return &testDataRunner{
			publisher:   s.Publisher,
			running:     false,
			speedMillis: 400,
			dropPercent: .6,
			channel:     channel,
		}, nil
	}

	return nil, fmt.Errorf("unknown channel")
}

// OnSubscribe will let anyone connect to the path
func (r *testDataRunner) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
	if !r.running {
		r.running = true

		// Run in the background
		go r.runRandomCSV()
	}

	return centrifuge.SubscribeReply{}, nil
}

// OnPublish checks if a message from the websocket can be broadcast on this channel
func (r *testDataRunner) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) (centrifuge.PublishReply, error) {
	return centrifuge.PublishReply{}, fmt.Errorf("can not publish to testdata")
}

// runRandomCSV is just for an example.
func (r *testDataRunner) runRandomCSV() {
	spread := 50.0

	walker := rand.Float64() * 100
	ticker := time.NewTicker(time.Duration(r.speedMillis) * time.Millisecond)

	measurement := models.Measurement{
		Name:   r.name,
		Time:   0,
		Values: make(map[string]interface{}, 5),
	}
	msg := models.MeasurementBatch{
		Measurements: []models.Measurement{measurement}, // always a single measurement
	}

	for t := range ticker.C {
		if rand.Float64() <= r.dropPercent {
			continue
		}
		delta := rand.Float64() - 0.5
		walker += delta

		measurement.Time = t.UnixNano() / int64(time.Millisecond)
		measurement.Values["value"] = walker
		measurement.Values["min"] = walker - ((rand.Float64() * spread) + 0.01)
		measurement.Values["max"] = walker + ((rand.Float64() * spread) + 0.01)

		bytes, err := json.Marshal(&msg)
		if err != nil {
			logger.Warn("unable to marshal line", "error", err)
			continue
		}

		err = r.publisher(r.channel, bytes)
		if err != nil {
			logger.Warn("write", "channel", r.channel, "measurement", measurement)
		}
	}
}
