package accesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
)

type AccessControl interface {
	registry.CanBeDisabled
	Evaluator
	GetUserPermissions(ctx context.Context, user *models.SignedInUser, roles []string) ([]*Permission, error)
}

type Evaluator interface {
	// Evaluate evaluates access to the given resource
	Evaluate(ctx context.Context, user *models.SignedInUser, permission string, scope ...string) (bool, error)
}
