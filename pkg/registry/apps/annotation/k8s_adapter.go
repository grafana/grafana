package annotation

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	authtypes "github.com/grafana/authlib/types"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/util"
)

var annotationGR = annotationV0.AnnotationKind().GroupVersionResource().GroupResource()

var (
	_ rest.Scoper               = (*k8sRESTAdapter)(nil)
	_ rest.SingularNameProvider = (*k8sRESTAdapter)(nil)
	_ rest.Getter               = (*k8sRESTAdapter)(nil)
	_ rest.Storage              = (*k8sRESTAdapter)(nil)
	_ rest.Creater              = (*k8sRESTAdapter)(nil)
	_ rest.Updater              = (*k8sRESTAdapter)(nil)
	_ rest.GracefulDeleter      = (*k8sRESTAdapter)(nil)
)

// k8sRESTAdapter adapts the Store interface to Kubernetes REST storage interface.
// This layer handles K8s API conventions (fieldSelectors, ListOptions, runtime.Object, etc.)
// and delegates actual storage operations to the Store interface.
type k8sRESTAdapter struct {
	store          Store
	tableConverter rest.TableConvertor
	accessClient   authtypes.AccessClient
	installer      *AppInstaller
}

func (s *k8sRESTAdapter) New() runtime.Object {
	return annotationV0.AnnotationKind().ZeroValue()
}

func (s *k8sRESTAdapter) Destroy() {
	// Stop background cleanup goroutines
	if s.installer != nil && s.installer.cleanupCancel != nil {
		s.installer.cleanupCancel()
		s.installer.cleanupWg.Wait()
	}

	// Call Close() on the PostgreSQL store to cleanup connection pool
	// TODO: add Close() to the Store interface so we can do proper cleanup for other store types
	if pg, ok := s.store.(*PostgreSQLStore); ok {
		pg.Close()
	}
}

func (s *k8sRESTAdapter) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *k8sRESTAdapter) GetSingularName() string {
	return "annotation"
}

func (s *k8sRESTAdapter) NewList() runtime.Object {
	return annotationV0.AnnotationKind().ZeroListValue()
}

func (s *k8sRESTAdapter) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *k8sRESTAdapter) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	namespace := request.NamespaceValue(ctx)

	opts := ListOptions{}
	if options.FieldSelector != nil {
		// Parse K8s field selectors into Store ListOptions
		for _, r := range options.FieldSelector.Requirements() {
			switch r.Field {
			case "spec.dashboardUID":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					opts.DashboardUID = r.Value
				} else {
					return nil, fmt.Errorf("unsupported operator %s for spec.dashboardUID (only = supported)", r.Operator)
				}

			case "spec.panelID":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					panelID, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid panelID value %q: %w", r.Value, err)
					}
					opts.PanelID = panelID
				} else {
					return nil, fmt.Errorf("unsupported operator %s for spec.panelID (only = supported)", r.Operator)
				}
			case "spec.time":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					from, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid time value %q: %w", r.Value, err)
					}
					opts.From = from
				} else {
					return nil, fmt.Errorf("unsupported operator %s for spec.from (only = supported)", r.Operator)
				}
			case "spec.timeEnd":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					to, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid timeEnd value %q: %w", r.Value, err)
					}
					opts.To = to
				} else {
					return nil, fmt.Errorf("unsupported operator %s for spec.to (only = supported)", r.Operator)
				}
			default:
				return nil, fmt.Errorf("unsupported field selector: %s", r.Field)
			}
		}
	}

	opts.Limit = 100
	if options.Limit > 0 {
		opts.Limit = options.Limit
	}

	// Extract continue token from request
	if options.Continue != "" {
		opts.Continue = options.Continue
	}

	result, err := s.store.List(ctx, namespace, opts)
	if err != nil {
		return nil, err
	}

	// TODO: post-fetch filtering breaks pagination - cursor advances by opts.Limit regardless of authz results.
	allowed, err := canAccessAnnotations(ctx, s.accessClient, namespace, result.Items, utils.VerbList)
	if err != nil {
		return nil, err
	}
	filtered := make([]annotationV0.Annotation, 0, len(result.Items))
	for i, anno := range result.Items {
		if allowed[i] {
			filtered = append(filtered, anno)
		}
	}

	return &annotationV0.AnnotationList{
		Items:    filtered,
		ListMeta: metav1.ListMeta{Continue: result.Continue},
	}, nil
}

func (s *k8sRESTAdapter) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace := request.NamespaceValue(ctx)

	annotation, err := s.store.Get(ctx, namespace, name)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, apierrors.NewNotFound(annotationGR, name)
		}
		return nil, err
	}

	allowed, err := canAccessAnnotation(ctx, s.accessClient, namespace, annotation, utils.VerbGet)
	if err != nil {
		return nil, err
	}
	if !allowed {
		// Return NotFound to avoid leaking existence.
		return nil, apierrors.NewNotFound(annotationGR, name)
	}

	return annotation, nil
}

func (s *k8sRESTAdapter) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	annotation, ok := obj.(*annotationV0.Annotation)
	if !ok {
		return nil, fmt.Errorf("expected annotation")
	}

	namespace := request.NamespaceValue(ctx)

	allowed, err := canAccessAnnotation(ctx, s.accessClient, namespace, annotation, utils.VerbCreate)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, apierrors.NewForbidden(annotationGR, annotation.Name, fmt.Errorf("insufficient permissions"))
	}

	if annotation.Name == "" && annotation.GenerateName == "" {
		return nil, apierrors.NewBadRequest("metadata.name or metadata.generateName is required")
	}

	if annotation.Name == "" && annotation.GenerateName != "" {
		annotation.Name = annotation.GenerateName + util.GenerateShortUID()
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, apierrors.NewUnauthorized("failed to get requester from context")
	}
	annotation.SetCreatedBy(user.GetUID())

	return s.store.Create(ctx, annotation)
}

func (s *k8sRESTAdapter) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	namespace := request.NamespaceValue(ctx)

	// Fetch the existing annotation for patch merging and to verify authz on the pre-update resource.
	existing, err := s.store.Get(ctx, namespace, name)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, false, apierrors.NewNotFound(annotationGR, name)
		}
		return nil, false, err
	}

	obj, err := objInfo.UpdatedObject(ctx, existing)
	if err != nil {
		return nil, false, err
	}

	resource, ok := obj.(*annotationV0.Annotation)
	if !ok {
		return nil, false, fmt.Errorf("expected annotation")
	}

	if resource.Name != name {
		return nil, false, fmt.Errorf("name in URL does not match name in body")
	}

	if resource.Namespace != namespace {
		return nil, false, fmt.Errorf("namespace in URL does not match namespace in body")
	}

	// Check authz on both existing and new body: prevents privilege escalation via scope changes.
	allowed, err := canAccessAnnotation(ctx, s.accessClient, namespace, existing, utils.VerbUpdate)
	if err != nil {
		return nil, false, err
	}
	if !allowed {
		return nil, false, apierrors.NewForbidden(annotationGR, existing.Name, fmt.Errorf("insufficient permissions"))
	}
	allowed, err = canAccessAnnotation(ctx, s.accessClient, namespace, resource, utils.VerbUpdate)
	if err != nil {
		return nil, false, err
	}
	if !allowed {
		return nil, false, apierrors.NewForbidden(annotationGR, resource.Name, fmt.Errorf("insufficient permissions"))
	}

	updated, err := s.store.Update(ctx, resource)
	if err != nil {
		return nil, false, err
	}

	return updated, false, nil
}

func (s *k8sRESTAdapter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	namespace := request.NamespaceValue(ctx)

	annotation, err := s.store.Get(ctx, namespace, name)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, false, apierrors.NewNotFound(annotationGR, name)
		}
		return nil, false, err
	}

	allowedDelete, err := canAccessAnnotation(ctx, s.accessClient, namespace, annotation, utils.VerbDelete)
	if err != nil {
		return nil, false, err
	}
	if !allowedDelete {
		// Return 404 if caller can't read (don't leak existence), 403 if readable but not deletable.
		allowedRead, err := canAccessAnnotation(ctx, s.accessClient, namespace, annotation, utils.VerbGet)
		if err != nil {
			return nil, false, err
		}
		if !allowedRead {
			return nil, false, apierrors.NewNotFound(annotationGR, name)
		}
		return nil, false, apierrors.NewForbidden(annotationGR, name, fmt.Errorf("insufficient permissions"))
	}

	err = s.store.Delete(ctx, namespace, name)
	if errors.Is(err, ErrNotFound) {
		return nil, false, apierrors.NewNotFound(annotationGR, name)
	}
	return nil, false, err
}

func (s *k8sRESTAdapter) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for annotation is not available")
}
