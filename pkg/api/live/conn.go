package live

import (
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
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

type subscription struct {
	name string
}

type connection struct {
	ws      *websocket.Conn
	streams []*subscription
	send    chan []byte
}

func newConnection(ws *websocket.Conn) *connection {
	return &connection{
		send:    make(chan []byte, 256),
		streams: make([]*subscription, 0),
		ws:      ws,
	}
}

func (c *connection) readPump() {
	defer func() {
		h.unregister <- c
		c.ws.Close()
	}()
	c.ws.SetReadLimit(maxMessageSize)
	c.ws.SetReadDeadline(time.Now().Add(pongWait))
	c.ws.SetPongHandler(func(string) error { c.ws.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.ws.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
				log.Info("error: %v", err)
			}
			break
		}

		c.handleMessage(message)
	}
}

func (c *connection) handleMessage(message []byte) {
	json, err := simplejson.NewJson(message)
	if err != nil {
		log.Error(3, "Unreadable message on websocket channel:", err)
	}

	msgType := json.Get("action").MustString()
	streamName := json.Get("stream").MustString()

	switch msgType {
	case "subscribe":
		c.streams = append(c.streams, &subscription{name: streamName})
		log.Info("Live: subscribing to stream %v", streamName)
	}
}

func (c *connection) write(mt int, payload []byte) error {
	c.ws.SetWriteDeadline(time.Now().Add(writeWait))
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
				c.write(websocket.CloseMessage, []byte{})
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

type LiveConn struct {
}

func New() *LiveConn {
	go h.run()
	return &LiveConn{}
}

func (lc *LiveConn) Serve(w http.ResponseWriter, r *http.Request) {
	log.Info("Live: Upgrading to WebSocket")

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error(3, "Live: Failed to upgrade connection to WebSocket", err)
		return
	}
	c := newConnection(ws)
	h.register <- c
	go c.writePump()
	c.readPump()
}
