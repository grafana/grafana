package transport

import (
	"io"
	"net/http"

	"github.com/googollee/go-engine.io/message"
	"github.com/googollee/go-engine.io/parser"
)

type Callback interface {
	OnPacket(r *parser.PacketDecoder)
	OnClose(server Server)
}

type Creater struct {
	Name      string
	Upgrading bool
	Server    func(w http.ResponseWriter, r *http.Request, callback Callback) (Server, error)
	Client    func(r *http.Request) (Client, error)
}

// Server is a transport layer in server to connect client.
type Server interface {

	// ServeHTTP handles the http request. It will call conn.onPacket when receive packet.
	ServeHTTP(http.ResponseWriter, *http.Request)

	// Close closes the transport.
	Close() error

	// NextWriter returns packet writer. This function call should be synced.
	NextWriter(messageType message.MessageType, packetType parser.PacketType) (io.WriteCloser, error)
}

// Client is a transport layer in client to connect server.
type Client interface {

	// Response returns the response of last http request.
	Response() *http.Response

	// NextReader returns packet decoder. This function call should be synced.
	NextReader() (*parser.PacketDecoder, error)

	// NextWriter returns packet writer. This function call should be synced.
	NextWriter(messageType message.MessageType, packetType parser.PacketType) (io.WriteCloser, error)

	// Close closes the transport.
	Close() error
}
