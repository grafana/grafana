package provisionedplugins

import "context"

type Manager interface {
	ProvisionedPlugins(ctx context.Context) ([]string, error)
}

var _ Manager = (*Noop)(nil)

type Noop struct{}

func NewNoop() *Noop {
	return &Noop{}
}

func (s *Noop) ProvisionedPlugins(_ context.Context) ([]string, error) {
	return []string{}, nil
}
