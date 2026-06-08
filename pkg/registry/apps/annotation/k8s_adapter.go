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
	"k8s.io/apimachinery/pkg/fields"
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

// toAPIError maps store-layer sentinels to the right k8s apierror so HTTP
// status + telemetry classification agree. Already-typed apierrors and unknown
// errors pass through unchanged (the apiserver will wrap the latter as 500).
func toAPIError(err error, name string) error {
	if err == nil {
		return nil
	}
	if _, ok := err.(apierrors.APIStatus); ok {
		return err
	}
	switch {
	case errors.Is(err, ErrNotFound):
		return apierrors.NewNotFound(annotationGR, name)
	case errors.Is(err, ErrAlreadyExists):
		return apierrors.NewAlreadyExists(annotationGR, name)
	case errors.Is(err, ErrInvalidInput):
		return apierrors.NewBadRequest(err.Error())
	default:
		return err
	}
}

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
	folderResolver DashboardFolderResolver
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
	if err := parseFieldSelector(options.FieldSelector, &opts); err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
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
		return nil, toAPIError(err, "")
	}

	// TODO: post-fetch filtering breaks pagination - cursor advances by opts.Limit regardless of authz results.
	allowed, err := canAccessAnnotations(ctx, s.accessClient, s.folderResolver, namespace, result.Items, utils.VerbList)
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
		return nil, toAPIError(err, name)
	}

	allowed, err := canAccessAnnotation(ctx, s.accessClient, s.folderResolver, namespace, annotation, utils.VerbGet)
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

	allowed, err := canAccessAnnotation(ctx, s.accessClient, s.folderResolver, namespace, annotation, utils.VerbCreate)
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

	created, err := s.store.Create(ctx, annotation)
	if err != nil {
		return nil, toAPIError(err, annotation.Name)
	}
	return created, nil
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
		return nil, false, toAPIError(err, name)
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
	allowed, err := canAccessAnnotation(ctx, s.accessClient, s.folderResolver, namespace, existing, utils.VerbUpdate)
	if err != nil {
		return nil, false, err
	}
	if !allowed {
		return nil, false, apierrors.NewForbidden(annotationGR, existing.Name, fmt.Errorf("insufficient permissions"))
	}
	allowed, err = canAccessAnnotation(ctx, s.accessClient, s.folderResolver, namespace, resource, utils.VerbUpdate)
	if err != nil {
		return nil, false, err
	}
	if !allowed {
		return nil, false, apierrors.NewForbidden(annotationGR, resource.Name, fmt.Errorf("insufficient permissions"))
	}

	updated, err := s.store.Update(ctx, resource)
	if err != nil {
		return nil, false, toAPIError(err, name)
	}
	return updated, false, nil
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
		return nil, false, toAPIError(err, name)
	}

	allowedDelete, err := canAccessAnnotation(ctx, s.accessClient, s.folderResolver, namespace, annotation, utils.VerbDelete)
	if err != nil {
		return nil, false, err
	}
	if !allowedDelete {
		// Return 404 if caller can't read (don't leak existence), 403 if readable but not deletable.
		allowedRead, rerr := canAccessAnnotation(ctx, s.accessClient, s.folderResolver, namespace, annotation, utils.VerbGet)
		if rerr != nil {
			return nil, false, rerr
		}
		if !allowedRead {
			return nil, false, apierrors.NewNotFound(annotationGR, name)
		}
		return nil, false, apierrors.NewForbidden(annotationGR, name, fmt.Errorf("insufficient permissions"))
	}

	if err := s.store.Delete(ctx, namespace, name); err != nil {
		return nil, false, toAPIError(err, name)
	}
	return nil, false, nil
}

// parseFieldSelector translates K8s field selectors into Store ListOptions.
func parseFieldSelector(fs fields.Selector, opts *ListOptions) error {
	if fs == nil {
		return nil
	}
	for _, r := range fs.Requirements() {
		if r.Operator != selection.Equals && r.Operator != selection.DoubleEquals {
			return fmt.Errorf("unsupported operator %s for %s (only = supported)", r.Operator, r.Field)
		}
		switch r.Field {
		case "spec.dashboardUID":
			opts.DashboardUID = r.Value
		case "spec.panelID":
			v, err := strconv.ParseInt(r.Value, 10, 64)
			if err != nil {
				return fmt.Errorf("invalid panelID value %q: %w", r.Value, err)
			}
			opts.PanelID = v
		case "spec.time":
			v, err := strconv.ParseInt(r.Value, 10, 64)
			if err != nil {
				return fmt.Errorf("invalid time value %q: %w", r.Value, err)
			}
			opts.From = v
		case "spec.timeEnd":
			v, err := strconv.ParseInt(r.Value, 10, 64)
			if err != nil {
				return fmt.Errorf("invalid timeEnd value %q: %w", r.Value, err)
			}
			opts.To = v
		default:
			return fmt.Errorf("unsupported field selector: %s", r.Field)
		}
	}
	return nil
}
