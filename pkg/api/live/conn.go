package live

import (
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 512
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type connection struct {
	hub  *hub
	ws   *websocket.Conn
	send chan []byte
	log  log.Logger
}

func newConnection(ws *websocket.Conn, hub *hub, logger log.Logger) *connection {
	return &connection{
		hub:  hub,
		send: make(chan []byte, 256),
		ws:   ws,
		log:  logger,
	}
}

func (c *connection) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.ws.Close()
	}()

	c.ws.SetReadLimit(maxMessageSize)
	if err := c.ws.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
		c.log.Warn("Setting read deadline failed", "err", err)
	}
	c.ws.SetPongHandler(func(string) error {
		return c.ws.SetReadDeadline(time.Now().Add(pongWait))
	})
	for {
		_, message, err := c.ws.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				c.log.Info("error", "err", err)
			}
			break
		}

		c.handleMessage(message)
	}
}

func (c *connection) handleMessage(message []byte) {
	json, err := simplejson.NewJson(message)
	if err != nil {
		log.Error(3, "Unreadable message on websocket channel. error: %v", err)
	}

	msgType := json.Get("action").MustString()
	streamName := json.Get("stream").MustString()

	if len(streamName) == 0 {
		log.Error(3, "Not allowed to subscribe to empty stream name")
		return
	}

	switch msgType {
	case "subscribe":
		c.hub.subChannel <- &streamSubscription{name: streamName, conn: c}
	case "unsubscribe":
		c.hub.subChannel <- &streamSubscription{name: streamName, conn: c, remove: true}
	}

}

func (c *connection) write(mt int, payload []byte) error {
	if err := c.ws.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
		return err
	}
	return c.ws.WriteMessage(mt, payload)
}

// writePump pumps messages from the hub to the websocket connection.
func (c *connection) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.ws.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				if err := c.write(websocket.CloseMessage, []byte{}); err != nil {
					c.log.Warn("Failed to write close message to connection", "err", err)
				}
				return
			}
			if err := c.write(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			if err := c.write(websocket.PingMessage, []byte{}); err != nil {
				return
			}
		}
	}
}
