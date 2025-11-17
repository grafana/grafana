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
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
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
) (*AnnotationAppInstaller, error) {
	installer := &AnnotationAppInstaller{
		cfg: cfg,
	}
	provider := simple.NewAppProvider(apis.LocalManifest(), nil, annotationapp.New)

	appConfig := app.Config{
		KubeConfig:   restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData: *apis.LocalManifest().ManifestData,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, apis.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i

	if service != nil {
		installer.legacy = &legacyStorage{
			service:    service,
			namespacer: request.GetNamespaceMapper(cfg),
		}
	}

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
	service        annotations.Repository
	namespacer     request.NamespaceMapper
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
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	query := &annotations.ItemQuery{OrgID: orgID, SignedInUser: user, AlertID: -1}
	if options.FieldSelector != nil {
		for _, r := range options.FieldSelector.Requirements() {
			switch r.Field {
			case "spec.dashboardUID":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					query.DashboardUID = r.Value
				} else {
					return nil, fmt.Errorf("unsupported operator %s for spec.dashboardUID (only = supported)", r.Operator)
				}

			case "spec.panelID":
				if r.Operator == selection.Equals || r.Operator == selection.DoubleEquals {
					panelID, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid panelID value %q: %w", r.Value, err)
					}
					query.PanelID = panelID
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
					query.From = from
				case selection.LessThan:
					to, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid time value %q: %w", r.Value, err)
					}
					query.To = to
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
					query.From = from
				case selection.LessThan:
					to, err := strconv.ParseInt(r.Value, 10, 64)
					if err != nil {
						return nil, fmt.Errorf("invalid timeEnd value %q: %w", r.Value, err)
					}
					query.To = to
				default:
					return nil, fmt.Errorf("unsupported operator %s for spec.timeEnd (only >, < supported for ranges)", r.Operator)
				}

			default:
				return nil, fmt.Errorf("unsupported field selector: %s", r.Field)
			}
		}
	}

	query.Limit = 100
	if options.Limit > 0 {
		query.Limit = options.Limit
	}
	items, err := s.service.Find(ctx, query)
	if err != nil {
		return nil, err
	}
	list := &annotationV0.AnnotationList{
		Items: make([]annotationV0.Annotation, len(items)),
	}
	for i, item := range items {
		c, err := toK8sResource(orgID, item, s.namespacer)
		if err != nil {
			return nil, err
		}
		list.Items[i] = *c
	}

	// TODO: pagination?
	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return nil, errors.New("fetching single annotations not supported by legacy storage")
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	return nil, errors.New("not implemented")
	// resource, ok := obj.(*correlationsV0.Correlation)
	// if !ok {
	// 	return nil, fmt.Errorf("expected correlation")
	// }
	//
	// cmd, err := correlations.ToCreateCorrelationCommand(resource)
	// if err != nil {
	// 	return nil, err
	// }
	//
	// out, err := s.service.CreateCorrelation(ctx, *cmd)
	// if err != nil {
	// 	return nil, err
	// }
	// return s.Get(ctx, out.UID, &metav1.GetOptions{})
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
	// before, err := s.Get(ctx, name, &metav1.GetOptions{})
	// if err != nil {
	// 	return nil, false, err
	// }
	// obj, err := objInfo.UpdatedObject(ctx, before)
	// if err != nil {
	// 	return nil, false, err
	// }
	//
	// resource, ok := obj.(*correlationsV0.Correlation)
	// if !ok {
	// 	return nil, false, fmt.Errorf("expected correlation")
	// }
	//
	// cmd, err := correlations.ToUpdateCorrelationCommand(resource)
	// if err != nil {
	// 	return nil, false, err
	// }
	//
	// out, err := s.service.UpdateCorrelation(ctx, *cmd)
	// if err != nil {
	// 	return nil, false, err
	// }
	// obj, err = s.Get(ctx, out.UID, &metav1.GetOptions{})
	// return obj, false, err
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, errors.New("not implemented")
	// orgID, err := request.OrgIDForList(ctx)
	// if err != nil {
	// 	return nil, false, err
	// }
	// err = s.service.DeleteCorrelation(ctx, correlations.DeleteCorrelationCommand{
	// 	OrgId: orgID,
	// 	UID:   name,
	// })
	// return nil, (err == nil), err
}

// CollectionDeleter
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for annotation not implemented")
}

func toK8sResource(orgID int64, item *annotations.ItemDTO, namespacer request.NamespaceMapper) (*annotationV0.Annotation, error) {
	annotation := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("a-%d", item.ID), // FIXME
			Namespace: namespacer(orgID),
		},
		Spec: annotationV0.AnnotationSpec{
			Text: item.Text,
			Time: item.Time,
			Tags: item.Tags,
		},
	}

	if item.DashboardUID != nil && *item.DashboardUID != "" {
		annotation.Spec.DashboardUID = item.DashboardUID
	}
	if item.PanelID != 0 {
		annotation.Spec.PanelID = &item.PanelID
	}
	if item.TimeEnd != 0 {
		annotation.Spec.TimeEnd = &item.TimeEnd
	}
	return annotation, nil
}
