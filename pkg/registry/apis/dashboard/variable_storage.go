package dashboard

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

// variableStorage wraps *registry.Store so that Create performs a post-write
// uniqueness verification. The admission-time uniqueness check in
// validateVariableNameUniqueness is TOCTOU-vulnerable: two concurrent Creates
// for the same (spec.spec.name, folder) can both see an empty list and both
// commit. This wrapper re-lists after the write and, if duplicates are
// observed, applies a deterministic tie-break (earliest creationTimestamp,
// then lowest UID). Both verifiers in a race reach the same conclusion, so
// exactly one object survives; the loser deletes itself and returns
// AlreadyExists to the client. The admission-level check remains the fast
// path for the common non-racing case.
type variableStorage struct {
	*registry.Store
	provider client.K8sHandlerProvider

	// innerCreate and innerDelete indirect through fields so tests can inject
	// fakes without constructing a real *registry.Store. In production they
	// point at the embedded store's methods.
	innerCreate func(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error)
	innerDelete func(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error)
}

var _ rest.Creater = (*variableStorage)(nil)

func newVariableStorage(store *registry.Store, provider client.K8sHandlerProvider) *variableStorage {
	return &variableStorage{
		Store:       store,
		provider:    provider,
		innerCreate: store.Create,
		innerDelete: store.Delete,
	}
}

func (s *variableStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	created, err := s.innerCreate(ctx, obj, createValidation, options)
	if err != nil {
		return created, err
	}

	// Dry-run does not persist, so the post-create list cannot see it and the
	// verification is meaningless. The admission-time check already ran.
	if options != nil && len(options.DryRun) > 0 {
		return created, nil
	}

	if s.provider == nil {
		return created, nil
	}

	variable, ok := created.(*dashv2.Variable)
	if !ok {
		return created, nil
	}

	lost, verifyErr := resolveVariableNameConflictAfterCreate(ctx, s.provider, variable)
	if verifyErr != nil {
		// Degrade gracefully: the admission-level check is the primary
		// guarantee. Do not fail the user's write because the post-write
		// verification could not be completed.
		logging.FromContext(ctx).Warn(
			"variable post-create uniqueness verification failed; keeping object",
			"name", variable.GetName(),
			"namespace", variable.GetNamespace(),
			"err", verifyErr,
		)
		return created, nil
	}

	if !lost {
		return created, nil
	}

	specName := getVariableName(variable.Spec)
	uid := variable.GetUID()
	deleteOpts := &metav1.DeleteOptions{
		Preconditions: &metav1.Preconditions{UID: &uid},
	}
	if _, _, deleteErr := s.innerDelete(ctx, variable.GetName(), nil, deleteOpts); deleteErr != nil {
		// The losing object may be briefly orphaned if this delete fails; the
		// next admission-level check on any subsequent create will catch it.
		// Surface AlreadyExists to the client either way
		logging.FromContext(ctx).Error(
			"failed to delete variable after losing uniqueness tie-break",
			"name", variable.GetName(),
			"namespace", variable.GetNamespace(),
			"uid", string(uid),
			"err", deleteErr,
		)
	}

	return nil, apierrors.NewAlreadyExists(dashv2.VariableResourceInfo.GroupResource(), specName)
}
