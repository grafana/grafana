package features

import (
	"encoding/json"
	"time"

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
	return b, nil // all dashboards share the same handler
}

// DoNamespaceHTTP is called from the HTTP API.
func (m *BroadcastRunner) DoNamespaceHTTP(c *models.ReqContext) {
	c.JSON(400, util.DynMap{
		"Unsupported": "BroadcastRunner",
	})
}

// OnSubscribe will let anyone connect to the path
func (b *BroadcastRunner) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
	return centrifuge.SubscribeReply{
		Options: centrifuge.SubscribeOptions{
			Presence:  true,
			JoinLeave: true,
			Recover:   true, // loads the saved value from history
		},
	}, nil
}

// OnPublish is called when a client wants to broadcast on the websocket
func (b *BroadcastRunner) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) (centrifuge.PublishReply, error) {
	return centrifuge.PublishReply{
		Options: centrifuge.PublishOptions{
			HistorySize: 1, // The last message is saved for 10 mins
			HistoryTTL:  10 * time.Minute,
		},
	}, nil
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

	if c.Req.Method == "GET" {
		c.JSON(400, util.DynMap{
			"GET unsupported": channel,
		})
		return
	}

	c.JSON(400, util.DynMap{
		"unsupported?": channel,
	})
}
