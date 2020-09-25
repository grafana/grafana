package features

import (
	"encoding/json"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/models"
)

// DashboardEvent events related to dashboards
type dashboardEvent struct {
	UID       string `json:"uid"`
	Action    string `json:"action"` // saved, editing
	UserID    int64  `json:"userId,omitempty"`
	SessionID string `json:"sessionId,omitempty"`
}

// DashboardHandler manages all the `grafana/dashboard/*` channels
type DashboardHandler struct {
	publisher models.ChannelPublisher
}

// CreateDashboardHandler Initialize a dashboard handler
func CreateDashboardHandler(p models.ChannelPublisher) DashboardHandler {
	return DashboardHandler{
		publisher: p,
	}
}

// GetHandlerForPath called on init
func (g *DashboardHandler) GetHandlerForPath(path string) (models.ChannelHandler, error) {
	return g, nil // all dashboards share the same handler
}

// GetChannelOptions called fast and often
func (g *DashboardHandler) GetChannelOptions(id string) centrifuge.ChannelOptions {
	return centrifuge.ChannelOptions{
		Presence:  true,
		JoinLeave: true, // if enterprise?
	}
}

// OnSubscribe for now allows anyone to subscribe to any dashboard
func (g *DashboardHandler) OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) error {
	// TODO? check authentication
	return nil
}

// OnPublish called when an event is received from the websocket
func (g *DashboardHandler) OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) ([]byte, error) {
	// TODO -- verify and keep track of editors?
	return e.Data, nil
}

// DashboardSaved should broadcast to the appropriate stream
func (g *DashboardHandler) publish(event dashboardEvent) error {
	msg, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return g.publisher("grafana/dashboard/"+event.UID, msg)
}

// DashboardSaved will broadcast to all connected dashboards
func (g *DashboardHandler) DashboardSaved(uid string, userID int64) error {
	return g.publish(dashboardEvent{
		UID:    uid,
		Action: "saved",
		UserID: userID,
	})
}

// DashboardDeleted will broadcast to all connected dashboards
func (g *DashboardHandler) DashboardDeleted(uid string, userID int64) error {
	return g.publish(dashboardEvent{
		UID:    uid,
		Action: "deleted",
		UserID: userID,
	})
}
