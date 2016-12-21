package live

import (
	"sync"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

type StreamManagerImpl struct {
	log           log.Logger
	streams       map[string]*Stream
	streamRWMutex *sync.RWMutex
}

func NewStreamManager() m.StreamManager {
	return &StreamManagerImpl{
		log:           log.New("live.stream.manager"),
		streams:       make(map[string]*Stream),
		streamRWMutex: &sync.RWMutex{},
	}
}

func (s *StreamManagerImpl) GetStreamList() m.StreamList {
	list := make(m.StreamList, 0)

	for _, stream := range s.streams {
		list = append(list, &m.StreamInfo{
			Name: stream.name,
		})
	}

	return list
}

func (s *StreamManagerImpl) Push(packet *m.StreamPacket) {
	stream, exist := s.streams[packet.Stream]

	if !exist {
		s.log.Info("Creating metric stream", "name", packet.Stream)
		stream = NewStream(packet.Stream)
		s.streams[stream.name] = stream
	}

	stream.Push(packet)
}

type Stream struct {
	subscribers []*connection
	name        string
}

func NewStream(name string) *Stream {
	return &Stream{
		subscribers: make([]*connection, 0),
		name:        name,
	}
}

func (s *Stream) Push(packet *m.StreamPacket) {

	messageBytes, _ := simplejson.NewFromAny(packet).Encode()

	for _, sub := range s.subscribers {
		// check if channel is open
		// if _, ok := h.connections[sub]; !ok {
		// 	delete(s.subscribers, sub)
		// 	continue
		// }

		sub.send <- messageBytes
	}
}
