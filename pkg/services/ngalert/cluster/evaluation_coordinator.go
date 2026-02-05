package cluster

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
)

// checkInterval is how often we check cluster position to determine if this node
// should evaluate alert rules.
const checkInterval = 5 * time.Second

type ClusterPositionProvider interface {
	Position() int
}

// EvaluationCoordinator determines whether alert rule evaluation should occur
// based on cluster position. Only the node with position 0 evaluates rules.
type EvaluationCoordinator struct {
	cluster ClusterPositionProvider
	log     log.Logger
}

func NewEvaluationCoordinator(cluster ClusterPositionProvider, logger log.Logger) (*EvaluationCoordinator, error) {
	if cluster == nil {
		return nil, errors.New("cluster position provider is required")
	}
	return &EvaluationCoordinator{cluster: cluster, log: logger}, nil
}

func (c *EvaluationCoordinator) shouldEvaluate() bool {
	return c.cluster.Position() == 0
}

// Updates emits the current evaluation decision immediately and then on changes.
// The channel is closed when ctx is done.
func (c *EvaluationCoordinator) Updates(ctx context.Context) <-chan bool {
	updates := make(chan bool, 1)
	go func() {
		defer close(updates)

		current := c.shouldEvaluate()
		sendLatest(updates, current)

		ticker := time.NewTicker(checkInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				next := c.shouldEvaluate()
				if next == current {
					continue
				}
				current = next
				sendLatest(updates, current)
			}
		}
	}()
	return updates
}

// sendLatest sends a value to a buffered channel, replacing any pending value.
// It ensures the channel always contains the most recent value by draining
// any existing value before sending. This prevents blocking when the consumer
// hasn't read the previous update yet.
func sendLatest(ch chan bool, value bool) {
	select {
	case ch <- value:
		return
	default:
	}
	select {
	case <-ch:
	default:
	}
	ch <- value
}

// NoopEvaluationCoordinator always signals that the node should evaluate alert rules.
type NoopEvaluationCoordinator struct{}

func NewNoopEvaluationCoordinator() *NoopEvaluationCoordinator {
	return &NoopEvaluationCoordinator{}
}

// Updates emits true immediately. Since Noop always evaluates (never changes),
// no further updates are emitted.
func (c *NoopEvaluationCoordinator) Updates(ctx context.Context) <-chan bool {
	updates := make(chan bool, 1)
	updates <- true
	go func() {
		<-ctx.Done()
		close(updates)
	}()
	return updates
}
