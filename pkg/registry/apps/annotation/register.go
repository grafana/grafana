package annotation

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
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
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apiserverrest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	grafrequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg        *setting.Cfg
	k8sAdapter *k8sRESTAdapter
}

// RegisterAppInstaller Layers (from bottom to top):
//  1. annotations.Repository - old Grafana annotation service
//  2. sqlAdapter - Bridges annotations.Repository → Store interface (apps/annotation/Store), converts ItemDTO ↔ v0alpha1.Annotation
//  3. k8sRESTAdapter - Bridges Store → K8s REST interface, handles K8s API conventions
func RegisterAppInstaller(
	cfg *setting.Cfg,
	service annotations.Repository,
	cleaner annotations.Cleaner,
) (*AppInstaller, error) {
	installer := &AppInstaller{
		cfg: cfg,
	}

	var tagHandler func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error
	if service != nil {
		mapper := grafrequest.GetNamespaceMapper(cfg)

		// Layer 1→2: Wrap old annotations.Repository with sqlAdapter (implements Store interface)
		sqlAdapter := NewSQLAdapter(service, cleaner, mapper, cfg)

		// Layer 2→3: Wrap Store interface with K8s REST adapter
		installer.k8sAdapter = &k8sRESTAdapter{
			store:  sqlAdapter,
			mapper: mapper,
		}

		// Create the tags handler using the sqlAdapter (which implements TagProvider)
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
	return authorizer.AuthorizerFunc(func(
		ctx context.Context, attr authorizer.Attributes,
	) (authorized authorizer.Decision, reason string, err error) {
		if !attr.IsResourceRequest() {
			return authorizer.DecisionNoOpinion, "", nil
		}

		// Any authenticated user can access the API
		return authorizer.DecisionAllow, "", nil
	})
}

// GetLegacyStorage returns the K8s REST storage implementation for the annotation resource.
// Called by the app platform to get the storage backend.
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

	// Set up table converter for kubectl-style output
	a.k8sAdapter.tableConverter = utils.NewTableConverter(
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

	return a.k8sAdapter
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
	mapper         grafrequest.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *k8sRESTAdapter) New() runtime.Object {
	return annotationV0.AnnotationKind().ZeroValue()
}

func (s *k8sRESTAdapter) Destroy() {}

func (s *k8sRESTAdapter) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *k8sRESTAdapter) GetSingularName() string {
	return strings.ToLower(annotationV0.AnnotationKind().Kind())
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

	// Return list with continue token for pagination
	return &annotationV0.AnnotationList{
		Items:    result.Items,
		ListMeta: metav1.ListMeta{Continue: result.Continue},
	}, nil
}

func (s *k8sRESTAdapter) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace := request.NamespaceValue(ctx)
	return s.store.Get(ctx, namespace, name)
}

func (s *k8sRESTAdapter) Create(ctx context.Context,
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

func (s *k8sRESTAdapter) Update(ctx context.Context,
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

func (s *k8sRESTAdapter) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	namespace := request.NamespaceValue(ctx)
	err := s.store.Delete(ctx, namespace, name)
	return nil, false, err
}

func (s *k8sRESTAdapter) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for annotation is not available")
}
