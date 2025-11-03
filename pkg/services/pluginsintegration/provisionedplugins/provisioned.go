package provisionedplugins

import "context"

type Manager interface {
	ProvisionedPlugins(ctx context.Context) ([]Plugin, error)
}

var _ Manager = (*Noop)(nil)

type Plugin struct {
	ID  string
	URL string
}

type Noop struct{}

func NewNoop() *Noop {
	return &Noop{}
}

func (s *Noop) ProvisionedPlugins(_ context.Context) ([]Plugin, error) {
	return []Plugin{}, nil
}
