package models

import "github.com/centrifugal/centrifuge"

// ChannelPublisher writes data into a channel. Note that pemissions are not checked.
type ChannelPublisher func(channel string, data []byte) error

// ChannelHandler defines the core channel behavior
type ChannelHandler interface {
	// This is called fast and often -- it must be synchrnozed
	GetChannelOptions(id string) centrifuge.ChannelOptions

	// Called when a client wants to subscribe to a channel
	OnSubscribe(c *centrifuge.Client, e centrifuge.SubscribeEvent) error

	// Called when something writes into the channel.  The returned value will be broadcast if len() > 0
	OnPublish(c *centrifuge.Client, e centrifuge.PublishEvent) ([]byte, error)
}

// ChannelHandlerFactory should be implemented by all core features.
type ChannelHandlerFactory interface {
	// GetHandlerForPath gets a ChannelHandler for a path.
	// This is called fast and often -- it must be synchronized
	GetHandlerForPath(path string) (ChannelHandler, error)
}

// DashboardActivityChannel is a service to advertise dashboard activity
type DashboardActivityChannel interface {
	DashboardSaved(uid string, userID int64) error
	DashboardDeleted(uid string, userID int64) error
}
