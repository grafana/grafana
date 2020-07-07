package stream

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
	id   uint64

	// TODO: add
	// user/userId?
	// connection time?
}

var counter uint64 = 100

func newConnection(ws *websocket.Conn, hub *hub, logger log.Logger) *connection {
	counter = counter + 1
	return &connection{
		hub:  hub,
		send: make(chan []byte, 256),
		ws:   ws,
		log:  logger,
		id:   counter,
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
		return
	}

	streamName := json.Get("stream").MustString()
	action := json.Get("action").MustString()
	cid := json.Get("cid").MustInt64()
	body := json.Get("body")

	c.log.Info("GOT message!", "action", action)

	// Will proces channel actions
	c.hub.action <- &channelAction{name: streamName, conn: c, cid: cid, action: action, body: body}

	// (TEMP) WRITE IT BACK TO THE same channel
	err = c.write(websocket.TextMessage, message)
	if err != nil {
		log.Warn("Error Writing same socket back to the channel", "err", err)
	}

	// switch msgType {
	// case "subscribe":
	// 	c.hub.subChannel <- &streamSubscription{name: streamName, conn: c}
	// case "unsubscribe":
	// 	c.hub.subChannel <- &streamSubscription{name: streamName, conn: c, remove: true}
	// }
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
		c.log.Info("write pump closed!")
		ticker.Stop()
		c.ws.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.log.Info("Message channel not ok??")
				if err := c.write(websocket.CloseMessage, []byte{}); err != nil {
					c.log.Warn("Failed to write close message to connection", "err", err)
				}
				return
			}
			c.log.Info("WRITE Text", "len", len(message))
			if err := c.write(websocket.TextMessage, message); err != nil {
				c.log.Info("CONN Write error", "err", err)
				return
			}
		case <-ticker.C:
			c.log.Info("Ticker", "id", c.id)
			if err := c.write(websocket.PingMessage, []byte{}); err != nil {
				return
			}
		}
	}
}
