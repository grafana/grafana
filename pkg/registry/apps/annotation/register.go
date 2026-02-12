package annotation

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/annotation/pkg/apis"
	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	annotationapp "github.com/grafana/grafana/apps/annotation/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apiserverrest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	grafrequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg         *setting.Cfg
	legacy      *legacyStorage
	authService *accesscontrol.AuthService
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	service annotations.Repository,
	cleaner annotations.Cleaner,
	authService *accesscontrol.AuthService,
) (*AppInstaller, error) {
	installer := &AppInstaller{
		cfg:         cfg,
		authService: authService,
	}

	var tagHandler func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error
	if service != nil {
		mapper := grafrequest.GetNamespaceMapper(cfg)
		sqlAdapter := NewSQLAdapter(service, cleaner, mapper, cfg)
		installer.legacy = &legacyStorage{
			store:       sqlAdapter,
			mapper:      mapper,
			authService: authService,
		}
		// Create the tags handler using the sqlAdapter as TagProvider
		tagHandler = newTagsHandler(sqlAdapter)
	}

	provider := simple.NewAppProvider(apis.LocalManifest(), nil, annotationapp.New)

	appConfig := app.Config{
		KubeConfig:   restclient.Config{},
		ManifestData: *apis.LocalManifest().ManifestData,
		SpecificConfig: &annotationapp.AnnotationConfig{
			TagHandler: tagHandler,
		},
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, apis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	return installer, nil
}

func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	return grafanaauthorizer.NewServiceAuthorizer()
}

func (a *AppInstaller) Mutate(ctx context.Context, attr admission.Attributes, _ admission.ObjectInterfaces) error {
	verb := attr.GetOperation()

	// Only check authorization for write operations
	if verb != admission.Create && verb != admission.Update && verb != admission.Delete {
		return nil
	}

	// Get the current user
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return fmt.Errorf("authentication required: %w", err)
	}

	// Get the annotation object
	obj := attr.GetObject()
	annotation, ok := obj.(*annotationV0.Annotation)
	if !ok {
		return fmt.Errorf("expected annotation, got %T", obj)
	}

	// Extract dashboard UID
	dashboardUID := ""
	if annotation.Spec.DashboardUID != nil {
		dashboardUID = *annotation.Spec.DashboardUID
	}

	// Build authorization query
	query := annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        user.GetOrgID(),
		DashboardUID: dashboardUID,
		Limit:        1,
	}

	// Check permissions using authService
	resources, err := a.authService.Authorize(ctx, query)
	if err != nil {
		return fmt.Errorf("authorization failed: %w", err)
	}

	// Verify user has access
	if dashboardUID != "" {
		// Dashboard annotation - check dashboard access
		if _, canAccess := resources.Dashboards[dashboardUID]; !canAccess {
			return fmt.Errorf("user does not have permission to %s annotations on dashboard %s", verb, dashboardUID)
		}
	} else {
		// Organization annotation - check org access
		if !resources.CanAccessOrgAnnotations {
			return fmt.Errorf("user does not have permission to %s organization annotations", verb)
		}
	}

	return nil
}

func (a *AppInstaller) GetLegacyStorage(requested schema.GroupVersionResource) apiserverrest.Storage {
	kind := annotationV0.AnnotationKind()
	gvr := schema.GroupVersionResource{
		Group:    kind.Group(),
		Version:  kind.Version(),
		Resource: kind.Plural(),
	}

	if requested.String() != gvr.String() {
		return nil
	}

	a.legacy.tableConverter = utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Text", Type: "string", Format: "name"},
			},
			Reader: func(obj any) ([]any, error) {
				m, ok := obj.(*annotationV0.Annotation)
				if !ok {
					return nil, fmt.Errorf("expected Annotation")
				}
				return []any{
					m.Spec.Text,
				}, nil
			},
		},
	)

	return a.legacy
}

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	store          Store
	mapper         grafrequest.NamespaceMapper
	tableConverter rest.TableConvertor
	authService    *accesscontrol.AuthService
}

func (s *legacyStorage) New() runtime.Object {
	return annotationV0.AnnotationKind().ZeroValue()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return strings.ToLower(annotationV0.AnnotationKind().Kind())
}

func (s *legacyStorage) NewList() runtime.Object {
	return annotationV0.AnnotationKind().ZeroListValue()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	namespace := request.NamespaceValue(ctx)

	opts := ListOptions{}
	if options.FieldSelector != nil {
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

	// Fetch from storage
	result, err := s.store.List(ctx, namespace, opts)
	if err != nil {
		return nil, err
	}

	// Get user for authorization
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, errors.NewUnauthorized("authentication required")
	}

	// Build authorization query
	query := annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        user.GetOrgID(),
		Limit:        1,
	}

	// Check permissions
	resources, err := s.authService.Authorize(ctx, query)
	if err != nil {
		// Return empty list on authorization error
		return &annotationV0.AnnotationList{
			Items:    []annotationV0.Annotation{},
			ListMeta: metav1.ListMeta{Continue: result.Continue},
		}, nil
	}

	// Filter annotations based on permissions
	filtered := make([]annotationV0.Annotation, 0, len(result.Items))
	for _, anno := range result.Items {
		if s.canAccessAnnotation(&anno, resources) {
			filtered = append(filtered, anno)
		}
	}

	return &annotationV0.AnnotationList{
		Items:    filtered,
		ListMeta: metav1.ListMeta{Continue: result.Continue},
	}, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace := request.NamespaceValue(ctx)

	// Fetch the annotation from storage
	annotation, err := s.store.Get(ctx, namespace, name)
	if err != nil {
		return nil, err
	}

	// Check user permissions
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, errors.NewUnauthorized("authentication required")
	}

	// Extract dashboard UID
	dashboardUID := ""
	if annotation.Spec.DashboardUID != nil {
		dashboardUID = *annotation.Spec.DashboardUID
	}

	// Build authorization query
	query := annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        user.GetOrgID(),
		DashboardUID: dashboardUID,
		Limit:        1,
	}

	// Check permissions
	resources, err := s.authService.Authorize(ctx, query)
	if err != nil {
		// Return NotFound instead of Forbidden to avoid leaking existence
		return nil, errors.NewNotFound(
			annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
			name,
		)
	}

	// Verify access to this specific annotation
	if !s.canAccessAnnotation(annotation, resources) {
		return nil, errors.NewNotFound(
			annotationV0.AnnotationKind().GroupVersionResource().GroupResource(),
			name,
		)
	}

	return annotation, nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	resource, ok := obj.(*annotationV0.Annotation)
	if !ok {
		return nil, fmt.Errorf("expected annotation")
	}
	return s.store.Create(ctx, resource)
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	namespace := request.NamespaceValue(ctx)

	obj, err := objInfo.UpdatedObject(ctx, nil)
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

	updated, err := s.store.Update(ctx, resource)
	if err != nil {
		return nil, false, err
	}

	return updated, false, nil
}

func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	namespace := request.NamespaceValue(ctx)
	err := s.store.Delete(ctx, namespace, name)
	return nil, false, err
}

func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for annotation is not available")
}

func (s *legacyStorage) canAccessAnnotation(anno *annotationV0.Annotation, resources *accesscontrol.AccessResources) bool {
	// Organization annotations (no dashboard UID)
	if anno.Spec.DashboardUID == nil || *anno.Spec.DashboardUID == "" {
		return resources.CanAccessOrgAnnotations
	}

	// Dashboard annotations - check if user has access to the dashboard
	dashboardUID := *anno.Spec.DashboardUID
	_, canAccess := resources.Dashboards[dashboardUID]
	return canAccess
}
