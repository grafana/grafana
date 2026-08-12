package reconciler

import (
	"context"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

var _ zanzana.MTReconciler = (*NoopReconciler)(nil)

type NoopReconciler struct{}

func (n *NoopReconciler) Run(ctx context.Context) error {
	return nil
}

func (n *NoopReconciler) EnsureNamespace(ctx context.Context, namespace string) error {
	return nil
}

func NewNoopReconciler() *NoopReconciler {
	return &NoopReconciler{}
}
