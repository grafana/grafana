package state

import (
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type SyncLabels struct {
	data data.Labels
	mu   *sync.RWMutex
}

func NewSyncLabels(data map[string]string) *SyncLabels {
	if data == nil {
		data = make(map[string]string)
	}

	return &SyncLabels{
		data: data,
		mu:   &sync.RWMutex{},
	}
}

func (s *SyncLabels) Set(k, v string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data[k] = v
}

func (s *SyncLabels) Get(k string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.data[k]
	return v, ok
}

func (s *SyncLabels) GetAll() data.Labels {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data.Copy()
}

func (s *SyncLabels) SetAll(data map[string]string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data = data
}

func (s *SyncLabels) Len() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.data)
}

func (s *SyncLabels) Delete(k string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, k)
}

func (s *SyncLabels) Range(f func(k, v string) bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for k, v := range s.data {
		if !f(k, v) {
			break
		}
	}
}
