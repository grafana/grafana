package stream

import (
	"errors"
	"github.com/grafana/grafana/pkg/infra/log"
	"strings"
	"sync"
)

type Stream struct {
	name        string // The path
	subscribers []*connection
	count       uint64 // Count within the channel
	mux         sync.Mutex
	log         log.Logger
}

func NewStream(fullPath string, logger log.Logger) (*Stream, error) {
	idx := strings.Index(fullPath, "/")
	if idx < 1 {
		return nil, errors.New("Invalid stream path.  Should be ${source}/${path}")
	}
	source := fullPath[:idx]
	path := fullPath[idx+1:]

	logger.Info("Creating stream", "source", source, "path", path)

	return &Stream{
		subscribers: make([]*connection, 0),
		name:        fullPath,
		mux:         sync.Mutex{},
		count:       0,
		log:         logger,
	}, nil
}

func (s *Stream) Subscribe(conn *connection) bool {
	s.mux.Lock()
	defer s.mux.Unlock()

	for _, c := range s.subscribers {
		if c == conn {
			return false
		}
	}
	s.subscribers = append(s.subscribers, conn)
	return true
}

func (s *Stream) Unsubscribe(conn *connection) bool {
	s.mux.Lock()
	defer s.mux.Unlock()

	for idx, c := range s.subscribers {
		if c == conn {
			// Remove the connection
			s.subscribers = append(s.subscribers[:idx], s.subscribers[idx+1:]...)
			return true
		}
	}
	return false
}

func (s *Stream) HandleAction(h *hub, cmd *channelAction) (interface{}, error) {
	if true {
		cmd.conn.log.Info("TODO... something smart, for now just broadcast")
		h.broadcast <- &channelBroadcast{
			name: cmd.name,
			body: cmd.body, // Send the command body to everyone!
		}
	}
	return "Something here (returned to just the caller)", nil
}
