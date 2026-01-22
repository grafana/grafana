package cluster

type ClusterPositionProvider interface {
	Position() int
}

// EvaluationCoordinator determines whether alert rule evaluation should occur
// based on cluster position. Only the node with position 0 evaluates rules.
type EvaluationCoordinator struct {
	cluster ClusterPositionProvider
}

func NewEvaluationCoordinator(cluster ClusterPositionProvider) *EvaluationCoordinator {
	return &EvaluationCoordinator{cluster: cluster}
}

// ShouldEvaluate returns true if this node should evaluate alert rules.
func (c *EvaluationCoordinator) ShouldEvaluate() bool {
	if c.cluster == nil {
		return true
	}
	return c.cluster.Position() == 0
}
