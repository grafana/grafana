package stream

import (
	"context"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
)

type hub struct {
	log         log.Logger
	connections map[*connection]bool
	streams     map[string]*Stream

	register   chan *connection
	unregister chan *connection
	action     chan *channelAction
	broadcast  chan *channelBroadcast
}

type channelAction struct {
	cid    int64
	conn   *connection
	name   string
	action string
	body   *simplejson.Json
}

type channelBroadcast struct {
	name string
	body interface{}
}

func newHub() *hub {
	return &hub{
		connections: make(map[*connection]bool),
		streams:     make(map[string]*Stream),
		register:    make(chan *connection),
		unregister:  make(chan *connection),
		action:      make(chan *channelAction),
		log:         log.New("stream.hub"),
	}
}

func (h *hub) run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case c := <-h.register:
			h.connections[c] = true
			h.log.Info("New connection", "total", len(h.connections))

		case c := <-h.unregister:
			if _, ok := h.connections[c]; ok {
				h.log.Info("Closing connection", "total", len(h.connections))
				delete(h.connections, c)
				close(c.send)
			}
			// hand stream subscriptions
		case sub := <-h.action:
			stream, exists := h.streams[sub.name]
			rsp := make(map[string]interface{})
			rsp["__cid"] = sub.cid
			rsp["__action"] = sub.action
			rsp["stream"] = sub.name
			h.log.Info("ACTION", "channel", sub.name, "action", sub.action)

			// handle unsubscribe
			if "unsubscribe" == sub.action {
				if !exists {
					h.log.Info("Already unsubscribed", "channel", sub.name)
					continue
				}
				stream.Unsubscribe(sub.conn)
				h.log.Info("Unsubscribe", "channel", sub.name)
				if len(stream.subscribers) < 1 {
					delete(h.streams, sub.name)
					h.log.Info("TODO shutdown stream!!!", "channel", sub.name)
				}
			} else if "subscribe" == sub.action {
				if !exists {
					var err error
					stream, err = NewStream(sub.name, h.log)
					if err != nil {
						h.log.Info("Error creating stream", "channel", sub.name)
						rsp["__error"] = err.Error
					}
					h.streams[sub.name] = stream
				}

				if stream != nil {
					subscribed := stream.Subscribe(sub.conn)
					h.log.Info("Subscribe", "channel", sub.name, "subscribed", subscribed)
				}
			} else if !exists {
				rsp["__error"] = "Channel does not exist"
			} else {
				body, err := stream.HandleAction(h, sub)
				if err != nil {
					rsp["__error"] = err.Error
				}
				rsp["body"] = body
			}

			// Write a response just to the caller
			messageBytes, _ := simplejson.NewFromAny(rsp).Encode()
			h.log.Info("Action RESPONSE", "json", string(messageBytes))
			sub.conn.send <- messageBytes
			//			sub.conn.write(websocket.TextMessage, messageBytes)

		// handle stream messages
		case broadcast := <-h.broadcast:
			stream, exists := h.streams[broadcast.name]
			if !exists {
				h.log.Info("broadcast to unknown channel", "stream", broadcast.name)
				continue
			}
			if len(stream.subscribers) < 1 {
				h.log.Info("Message to stream without subscribers", "stream", broadcast.name)
				continue
			}
			rsp := make(map[string]interface{})
			rsp["stream"] = broadcast.name
			rsp["body"] = broadcast.body
			messageBytes, _ := simplejson.NewFromAny(rsp).Encode()
			h.log.Info("BROADCAST", "channel", broadcast.name, "json", string(messageBytes))

			for _, c := range stream.subscribers {
				if _, ok := h.connections[c]; !ok {
					//delete(subscribers, sub)
					continue
				}

				select {
				case c.send <- messageBytes:
				default:
					// close(sub.send)
					// delete(h.connections, sub)
					// delete(subscribers, sub)
				}
			}
		}
	}
}
