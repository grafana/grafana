package managedplugins

type Manager interface {
	Managed(pluginID string) bool
}

var _ Manager = (*Noop)(nil)

type Noop struct{}

func NewNoop() *Noop {
	return &Noop{}
}

func (s *Noop) Managed(_ string) bool {
	return false
}
