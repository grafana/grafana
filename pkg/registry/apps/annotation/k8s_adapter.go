package annotation

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
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
	"github.com/grafana/grafana/pkg/infra/log"
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

	tracer  trace.Tracer
	metrics *Metrics
	logger  log.Logger
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

	// Release backend resources (postgres pool, gRPC connection, ...). Close()
	// on the decorator passes through to the underlying backend
	if s.store != nil {
		if err := s.store.Close(); err != nil {
			s.logger.Error("annotation store close failed", "error", err)
		}
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

func (s *k8sRESTAdapter) List(ctx context.Context, options *internalversion.ListOptions) (out runtime.Object, err error) {
	namespace := request.NamespaceValue(ctx)
	ctx, span := s.tracer.Start(ctx, "annotation.k8s.list", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer span.End()
	start := time.Now()
	defer func() { observe(ctx, s.logger, s.metrics.RequestDuration, "list", start, err) }()

	opts := ListOptions{}
	if options.FieldSelector != nil {
		// Parse K8s field selectors into Store ListOptions
		for _, r := range options.FieldSelector.Requirements() {
			switch r.Field {
			case "spec.dashboardUID":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					opts.DashboardUID = r.Value
				} else {
					return nil, apierrors.NewBadRequest(fmt.Sprintf("unsupported operator %s for spec.dashboardUID (only = supported)", r.Operator))
				}

			case "spec.panelID":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					panelID, perr := strconv.ParseInt(r.Value, 10, 64)
					if perr != nil {
						return nil, apierrors.NewBadRequest(fmt.Sprintf("invalid panelID value %q: %v", r.Value, perr))
					}
					opts.PanelID = panelID
				} else {
					return nil, apierrors.NewBadRequest(fmt.Sprintf("unsupported operator %s for spec.panelID (only = supported)", r.Operator))
				}
			case "spec.time":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					from, perr := strconv.ParseInt(r.Value, 10, 64)
					if perr != nil {
						return nil, apierrors.NewBadRequest(fmt.Sprintf("invalid time value %q: %v", r.Value, perr))
					}
					opts.From = from
				} else {
					return nil, apierrors.NewBadRequest(fmt.Sprintf("unsupported operator %s for spec.from (only = supported)", r.Operator))
				}
			case "spec.timeEnd":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					to, perr := strconv.ParseInt(r.Value, 10, 64)
					if perr != nil {
						return nil, apierrors.NewBadRequest(fmt.Sprintf("invalid timeEnd value %q: %v", r.Value, perr))
					}
					opts.To = to
				} else {
					return nil, apierrors.NewBadRequest(fmt.Sprintf("unsupported operator %s for spec.to (only = supported)", r.Operator))
				}
			default:
				return nil, apierrors.NewBadRequest(fmt.Sprintf("unsupported field selector: %s", r.Field))
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

func (s *k8sRESTAdapter) Get(ctx context.Context, name string, options *metav1.GetOptions) (out runtime.Object, err error) {
	namespace := request.NamespaceValue(ctx)
	ctx, span := s.tracer.Start(ctx, "annotation.k8s.get", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("name", name),
	))
	defer span.End()
	start := time.Now()
	defer func() { observe(ctx, s.logger, s.metrics.RequestDuration, "get", start, err) }()

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
) (out runtime.Object, err error) {
	namespace := request.NamespaceValue(ctx)
	ctx, span := s.tracer.Start(ctx, "annotation.k8s.create", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer span.End()
	start := time.Now()
	defer func() { observe(ctx, s.logger, s.metrics.RequestDuration, "create", start, err) }()

	annotation, ok := obj.(*annotationV0.Annotation)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("expected *Annotation, got %T", obj))
	}

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
) (out runtime.Object, created bool, err error) {
	namespace := request.NamespaceValue(ctx)
	ctx, span := s.tracer.Start(ctx, "annotation.k8s.update", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("name", name),
	))
	defer span.End()
	start := time.Now()
	defer func() { observe(ctx, s.logger, s.metrics.RequestDuration, "update", start, err) }()

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
		return nil, false, apierrors.NewInternalError(fmt.Errorf("expected *Annotation, got %T", obj))
	}

	if resource.Name != name {
		return nil, false, apierrors.NewBadRequest("name in URL does not match name in body")
	}

	if resource.Namespace != namespace {
		return nil, false, apierrors.NewBadRequest("namespace in URL does not match namespace in body")
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
	return updated, false, err
}

func (s *k8sRESTAdapter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (out runtime.Object, completed bool, err error) {
	namespace := request.NamespaceValue(ctx)
	ctx, span := s.tracer.Start(ctx, "annotation.k8s.delete", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("name", name),
	))
	defer span.End()
	start := time.Now()
	defer func() { observe(ctx, s.logger, s.metrics.RequestDuration, "delete", start, err) }()

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
		allowedRead, rerr := canAccessAnnotation(ctx, s.accessClient, namespace, annotation, utils.VerbGet)
		if rerr != nil {
			return nil, false, rerr
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
