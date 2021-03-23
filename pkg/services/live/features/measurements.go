package features

import (
	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

var (
	logger = log.New("live.features") // scoped to all features?
)

// MeasurementsRunner will simply broadcast all events to `grafana/broadcast/*` channels.
// This makes no assumptions about the shape of the data and will broadcast it to anyone listening
type MeasurementsRunner struct {
	Publisher models.ChannelPublisher
}

// GetHandlerForPath gets the handler for a path.
// It's called on init.
func (m *MeasurementsRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return m, nil // for now all channels share config
}

// DoNamespaceHTTP is called from the HTTP API.
func (m *MeasurementsRunner) DoNamespaceHTTP(c *models.ReqContext) {
	c.JSON(400, util.DynMap{
		"Unsupported": "MeasurementsRunner",
	})
}

// OnSubscribe will let anyone connect to the path
func (m *MeasurementsRunner) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
	return centrifuge.SubscribeReply{}, nil
}

// OnPublish is called when a client wants to broadcast on the websocket
// Currently this sends measurements over websocket -- should be replaced with the HTTP interface
func (m *MeasurementsRunner) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) (centrifuge.PublishReply, error) {
	return centrifuge.PublishReply{
		Options: centrifuge.PublishOptions{},
	}, nil
}

// DoChannelHTTP accepts POST from anywhere
func (m *MeasurementsRunner) DoChannelHTTP(c *models.ReqContext, channel string) {
	if c.Req.Method == "POST" {
		body, err := c.Req.Body().Bytes()
		if err != nil {
			c.JSON(500, util.DynMap{
				"message": "error reading body",
			})
			return
		}

		err = m.Publisher(channel, body)
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
		"unsupported?": channel,
	})
}
