package features

import (
	"encoding/json"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

var (
	logger = log.New("live.features") // scoped to all features?
)

// MeasurementsRunner will simply broadcast all events to `grafana/broadcast/*` channels
// This makes no assumptions about the shape of the data and will broadcast it to anyone listening
type MeasurementsRunner struct {
	Publisher models.ChannelPublisher
}

// GetHandlerForPath called on init
func (m *MeasurementsRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return m, nil // for now all channels share config
}

// DoNamespaceHTTP called from the http api
func (m *MeasurementsRunner) DoNamespaceHTTP(c *models.ReqContext) {
	c.JSON(400, util.DynMap{
		"Unsupportedd": "MeasurementsRunner",
	})
}

// GetChannelOptions called fast and often
func (m *MeasurementsRunner) GetChannelOptions(id string) centrifuge.ChannelOptions {
	return centrifuge.ChannelOptions{}
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (m *MeasurementsRunner) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) error {
	// anyone can subscribe
	return nil
}

// OnPublish called when an event is received from the websocket
func (m *MeasurementsRunner) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) ([]byte, error) {
	// currently generic... but should be more strict
	//logger.Debug("GOT: %s", e.Channel)
	return e.Data, nil
}

// DoChannelHTTP called from the http api
func (m *MeasurementsRunner) DoChannelHTTP(c *models.ReqContext, channel string) {
	if c.Req.Method == "POST" {
		body, err := c.Req.Body().Bytes()
		if err != nil {
			c.JSON(500, util.DynMap{
				"message": "error reading body",
			})
			return
		}

		msg := &models.MeasurementMessage{}
		err = json.Unmarshal(body, &msg)
		if err != nil {
			c.JSON(500, util.DynMap{
				"message": "body must be measurment",
			})
			return
		}

		err = m.Publisher(channel, body) // original bytes?
		if err != nil {
			c.JSON(500, util.DynMap{
				"message": "error publishing",
			})
			return
		}

		c.JSON(200, util.DynMap{
			"message": "OK",
		})
		return
	}

	c.JSON(400, util.DynMap{
		"unsuppoted?": channel,
	})
}
