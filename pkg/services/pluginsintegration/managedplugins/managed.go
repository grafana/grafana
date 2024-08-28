package managedplugins

import "context"

type Manager interface {
	ManagedPlugins(ctx context.Context) []string
}

var _ Manager = (*Noop)(nil)

type Noop struct{}

func NewNoop() *Noop {
	return &Noop{}
}

func (s *Noop) ManagedPlugins(_ context.Context) []string {
	return []string{}
}
