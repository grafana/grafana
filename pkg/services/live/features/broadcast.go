package features

import (
	"encoding/json"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// BroadcastRunner will simply broadcast all events to `grafana/broadcast/*` channels
// This assumes that data is a JSON object
type BroadcastRunner struct {
	Publisher models.ChannelPublisher
}

// GetHandlerForPath called on init
func (b *BroadcastRunner) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return b, nil // for now all channels share config
}

// DoNamespaceHTTP called from the http api
func (b *BroadcastRunner) DoNamespaceHTTP(c *models.ReqContext) {
	c.JSON(400, util.DynMap{
		"Unsupportedd": "BroadcastRunner",
	})
}

// GetChannelOptions called fast and often
func (b *BroadcastRunner) GetChannelOptions(id string) centrifuge.ChannelOptions {
	return centrifuge.ChannelOptions{
		// HistorySize:    1,
		// HistoryRecover: true,
	}
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (b *BroadcastRunner) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) error {
	// anyone can subscribe
	return nil
}

// OnPublish called when an event is received from the websocket
func (b *BroadcastRunner) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) ([]byte, error) {
	// expect the data to be the right shape?
	return e.Data, nil
}

// DoChannelHTTP accepts POST from anywhere
func (b *BroadcastRunner) DoChannelHTTP(c *models.ReqContext, channel string) {
	if c.Req.Method == "POST" {
		body, err := c.Req.Body().Bytes()
		if err != nil {
			c.JSON(500, util.DynMap{
				"message": "error reading body",
			})
			return
		}

		jsonMap := make(map[string](interface{}))
		err = json.Unmarshal(body, &jsonMap)
		if err != nil {
			c.JSON(500, util.DynMap{
				"message": "body must be valid JSON",
			})
			return
		}

		err = b.Publisher(channel, body)
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
