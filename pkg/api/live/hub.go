package live

import (
	"context"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
)

type hub struct {
	log         log.Logger
	connections map[*connection]bool
	streams     map[string]map[*connection]bool

	register      chan *connection
	unregister    chan *connection
	streamChannel chan *dtos.StreamMessage
	subChannel    chan *streamSubscription
}

type streamSubscription struct {
	conn   *connection
	name   string
	remove bool
}

func newHub() *hub {
	return &hub{
		connections:   make(map[*connection]bool),
		streams:       make(map[string]map[*connection]bool),
		register:      make(chan *connection),
		unregister:    make(chan *connection),
		streamChannel: make(chan *dtos.StreamMessage),
		subChannel:    make(chan *streamSubscription),
		log:           log.New("stream.hub"),
	}
}

func (h *hub) removeConnection() {
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
		case sub := <-h.subChannel:
			h.log.Info("Subscribing", "channel", sub.name, "remove", sub.remove)
			subscribers, exists := h.streams[sub.name]

			// handle unsubscribe
			if exists && sub.remove {
				delete(subscribers, sub.conn)
				continue
			}

			if !exists {
				subscribers = make(map[*connection]bool)
				h.streams[sub.name] = subscribers
			}

			subscribers[sub.conn] = true

			// handle stream messages
		case message := <-h.streamChannel:
			subscribers, exists := h.streams[message.Stream]
			if !exists || len(subscribers) == 0 {
				h.log.Info("Message to stream without subscribers", "stream", message.Stream)
				continue
			}

			messageBytes, _ := simplejson.NewFromAny(message).Encode()
			for sub := range subscribers {
				// check if channel is open
				if _, ok := h.connections[sub]; !ok {
					delete(subscribers, sub)
					continue
				}

				select {
				case sub.send <- messageBytes:
				default:
					close(sub.send)
					delete(h.connections, sub)
					delete(subscribers, sub)
				}
			}
		}
	}
}
