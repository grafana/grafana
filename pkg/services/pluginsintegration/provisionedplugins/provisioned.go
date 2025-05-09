package provisionedplugins

import (
	"context"
)

type ProvisionedPlugin struct {
	ID  string
	URL string
}

type Manager interface {
	ProvisionedPlugins(ctx context.Context) ([]ProvisionedPlugin, error)
}

var _ Manager = (*Noop)(nil)

type Noop struct{}

func NewNoop() *Noop {
	return &Noop{}
}

func (s *Noop) ProvisionedPlugins(_ context.Context) ([]ProvisionedPlugin, error) {
	return []ProvisionedPlugin{}, nil
}
