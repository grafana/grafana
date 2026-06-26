package pipeline

import (
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/live/orgchannel"
)

// FrameStorage keeps last channel frame in memory. Not usable in HA setup.
type FrameStorage struct {
	mu     sync.RWMutex
	frames map[string]*data.Frame
}

func NewFrameStorage() *FrameStorage {
	return &FrameStorage{
		frames: map[string]*data.Frame{},
	}
}

func (s *FrameStorage) Set(orgID int64, channel string, frame *data.Frame) error {
	key := orgchannel.PrependOrgID(orgID, channel)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.frames[key] = frame
	return nil
}

func (s *FrameStorage) Get(orgID int64, channel string) (*data.Frame, bool, error) {
	key := orgchannel.PrependOrgID(orgID, channel)
	s.mu.RLock()
	defer s.mu.RUnlock()
	f, ok := s.frames[key]
	return f, ok, nil
}
