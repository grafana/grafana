package resource

import "context"

// Pruner Small abstraction to allow for different Pruner implementations.
// This can be removed once the debouncer is deployed.
type Pruner interface {
	Add(key PruningKey) error
	Start(ctx context.Context)
}

// PruningKey is a comparable key for pruning history.
type PruningKey struct {
	Namespace string
	Group     string
	Resource  string
	Name      string
}

type NoopPruner struct{}

func (p *NoopPruner) Add(key PruningKey) error {
	return nil
}

func (p *NoopPruner) Start(ctx context.Context) {}
