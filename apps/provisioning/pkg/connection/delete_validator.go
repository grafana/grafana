package connection

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// DeleteValidator handles validation before deletion of Connection resources.
// It prevents deletion when repositories reference the connection.
type DeleteValidator struct {
	repoLister repository.RepositoryByConnectionLister
}

// NewDeleteValidator creates a new connection delete validator.
func NewDeleteValidator(repoLister repository.RepositoryByConnectionLister) *DeleteValidator {
	return &DeleteValidator{
		repoLister: repoLister,
	}
}

// ValidateDelete validates that a Connection can be deleted.
// It returns an error if any Repository references this Connection via spec.connection.name.
func (v *DeleteValidator) ValidateDelete(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	connectionName := a.GetName()
	if connectionName == "" {
		return nil
	}

	// Ensure the namespace is set in the context for the lister
	namespace := a.GetNamespace()
	if namespace != "" {
		ctx = request.WithNamespace(ctx, namespace)
	}

	// Find all repositories that reference this connection
	repos, err := v.repoLister.ListByConnection(ctx, connectionName)
	if err != nil {
		return fmt.Errorf("failed to check for referencing repositories: %w", err)
	}

	if len(repos) > 0 {
		repoNames := make([]string, len(repos))
		for i, repo := range repos {
			repoNames[i] = repo.GetName()
		}

		return apierrors.NewForbidden(
			schema.GroupResource{
				Group:    provisioning.GROUP,
				Resource: provisioning.ConnectionResourceInfo.GetName(),
			},
			connectionName,
			fmt.Errorf("referenced by %d repository(s): %v", len(repos), repoNames),
		)
	}

	return nil
}
