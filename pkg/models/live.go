package models

import (
	"context"
	"encoding/json"
	"time"
)

// ChannelPublisher writes data into a channel. Note that permissions are not checked.
type ChannelPublisher func(channel string, data []byte) error

// SubscribeEvent contains subscription data.
type SubscribeEvent struct {
	Channel string
	Path    string
}

// SubscribeReply is a reaction to SubscribeEvent.
type SubscribeReply struct {
	Presence  bool
	JoinLeave bool
	Recover   bool
	Data      json.RawMessage
}

// PublishEvent contains publication data.
type PublishEvent struct {
	Channel string
	Path    string
	Data    json.RawMessage
}

// PublishReply is a reaction to PublishEvent.
type PublishReply struct {
	// By default, it's a handler responsibility to publish data
	// into a stream upon OnPublish but setting Fallthrough to true
	// will make Grafana Live publish data itself (i.e. stream handler
	// just works as permission proxy in this case).
	Fallthrough bool
	// StreamSize sets a stream size.
	StreamSize int
	// StreamTTL with seconds (!) resolution.
	StreamTTL time.Duration
}

// ChannelHandler defines the core channel behavior
type ChannelHandler interface {
	// OnSubscribe is called when a client wants to subscribe to a channel
	OnSubscribe(ctx context.Context, user *SignedInUser, e SubscribeEvent) (SubscribeReply, bool, error)

	// OnPublish is called when a client writes a message to the channel websocket.
	OnPublish(ctx context.Context, user *SignedInUser, e PublishEvent) (PublishReply, bool, error)
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
