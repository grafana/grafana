package connection

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/endpoints/request"

	appadmission "github.com/grafana/grafana/apps/provisioning/pkg/apis/admission"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

// ReferencedByRepositoriesValidator validates that a connection is not referenced by any repositories.
// It implements the admission.Validator interface and only runs on delete operations.
type ReferencedByRepositoriesValidator struct {
	repoLister repository.RepositoryByConnectionLister
}

// NewReferencedByRepositoriesValidator creates a new validator that checks for referencing repositories.
func NewReferencedByRepositoriesValidator(repoLister repository.RepositoryByConnectionLister) appadmission.Validator {
	return &ReferencedByRepositoriesValidator{
		repoLister: repoLister,
	}
}

// Validate checks if a Connection can be deleted.
// It only runs on delete operations and returns an error if any Repository
// references this Connection via spec.connection.name.
func (v *ReferencedByRepositoriesValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	// Only validate delete operations
	if a.GetOperation() != admission.Delete {
		return nil
	}

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

		return apierrors.NewInvalid(
			provisioning.ConnectionResourceInfo.GroupVersionKind().GroupKind(),
			connectionName,
			field.ErrorList{field.Forbidden(
				field.NewPath("metadata", "name"),
				fmt.Sprintf("cannot delete connection: referenced by %d repository(s): %v", len(repos), repoNames),
			)},
		)
	}

	return nil
}
