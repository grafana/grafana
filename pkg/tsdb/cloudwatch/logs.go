package cloudwatch

import (
	"fmt"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/registry"
)

func init() {
	registry.RegisterService(&LogsService{})
}

// LogsService provides methods for querying CloudWatch Logs.
type LogsService struct {
	channelMu sync.Mutex
	// nolint:staticcheck // plugins.DataQueryResult deprecated
	responseChannels map[string]chan *backend.QueryDataResponse
	queues           map[string](chan bool)
	queueLock        sync.Mutex
}

// Init is called by the DI framework to initialize the instance.
func (s *LogsService) Init() error {
	// nolint:staticcheck // plugins.DataQueryResult deprecated
	s.responseChannels = make(map[string]chan *backend.QueryDataResponse)
	s.queues = make(map[string](chan bool))
	return nil
}

// nolint:staticcheck // plugins.DataQueryResult deprecated
func (s *LogsService) AddResponseChannel(name string, channel chan *backend.QueryDataResponse) error {
	s.channelMu.Lock()
	defer s.channelMu.Unlock()

	if _, ok := s.responseChannels[name]; ok {
		return fmt.Errorf("channel with name '%s' already exists", name)
	}

	s.responseChannels[name] = channel
	return nil
}

// nolint:staticcheck // plugins.DataQueryResult deprecated
func (s *LogsService) GetResponseChannel(name string) (chan *backend.QueryDataResponse, error) {
	s.channelMu.Lock()
	defer s.channelMu.Unlock()

	if responseChannel, ok := s.responseChannels[name]; ok {
		return responseChannel, nil
	}

	return nil, fmt.Errorf("channel with name '%s' not found", name)
}

func (s *LogsService) DeleteResponseChannel(name string) {
	s.channelMu.Lock()
	defer s.channelMu.Unlock()

	if _, ok := s.responseChannels[name]; ok {
		delete(s.responseChannels, name)
		return
	}

	plog.Warn("Channel with name '" + name + "' not found")
}
