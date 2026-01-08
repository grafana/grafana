package annotation

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
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
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AnnotationAppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*AnnotationAppInstaller)(nil)
)

type AnnotationAppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg    *setting.Cfg
	legacy *legacyStorage
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	service annotations.Repository,
	cleaner annotations.Cleaner,
) (*AnnotationAppInstaller, error) {
	installer := &AnnotationAppInstaller{
		cfg: cfg,
	}

	var tagHandler func(context.Context, app.CustomRouteResponseWriter, *app.CustomRouteRequest) error
	if service != nil {
		mapper := grafrequest.GetNamespaceMapper(cfg)
		sqlAdapter := NewSQLAdapter(service, cleaner, mapper, cfg)
		installer.legacy = &legacyStorage{
			store:  sqlAdapter,
			mapper: mapper,
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

func (a *AnnotationAppInstaller) GetLegacyStorage(requested schema.GroupVersionResource) apiserverrest.Storage {
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
				switch r.Operator {
				case selection.GreaterThan:
					from, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid time value %q: %w", r.Value, err)
					}
					opts.From = from
				case selection.LessThan:
					to, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid time value %q: %w", r.Value, err)
					}
					opts.To = to
				default:
					return nil, fmt.Errorf("unsupported operator %s for spec.time (only >, < supported for ranges)", r.Operator)
				}

			case "spec.timeEnd":
				switch r.Operator {
				case selection.GreaterThan:
					from, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid timeEnd value %q: %w", r.Value, err)
					}
					opts.From = from
				case selection.LessThan:
					to, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid timeEnd value %q: %w", r.Value, err)
					}
					opts.To = to
				default:
					return nil, fmt.Errorf("unsupported operator %s for spec.timeEnd (only >, < supported for ranges)", r.Operator)
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

	result, err := s.store.List(ctx, namespace, opts)
	if err != nil {
		return nil, err
	}

	return &annotationV0.AnnotationList{Items: result.Items}, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace := request.NamespaceValue(ctx)
	return s.store.Get(ctx, namespace, name)
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
	return nil, false, errors.New("not implemented")
}

func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	namespace := request.NamespaceValue(ctx)
	err := s.store.Delete(ctx, namespace, name)
	return nil, false, err
}

func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for annotation is not available")
}
