package managedplugins

import "context"

type Manager interface {
	ManagedPlugins(ctx context.Context) []string
	IsManagedPlugin(pluginID string) bool
}

var _ Manager = (*Noop)(nil)

type Noop struct{}

func NewNoop() *Noop {
	return &Noop{}
}

func (s *Noop) ManagedPlugins(_ context.Context) []string {
	return []string{}
}

func (s *Noop) IsManagedPlugin(_ string) bool {
	return false
}
