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
			storage: &RepositoryStorage{repo: service, namespacer: request.GetNamespaceMapper(cfg)},
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
	storage        Storage
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
	items, err := s.storage.List(ctx, opts)
	return &annotationV0.AnnotationList{Items: items}, err
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return nil, errors.New("fetching single annotations not supported by legacy storage")
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
	created, err := s.storage.Create(ctx, *resource)
	return created, err
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

type ListOptions struct {
	DashboardUID string
	PanelID      int64
	From         int64
	To           int64
	Limit        int64
	// TODO: continuation token
}
type Storage interface {
	List(context.Context, ListOptions) ([]annotationV0.Annotation, error)
	Create(context.Context, annotationV0.Annotation) (annotationV0.Annotation, error)
	Update(context.Context, annotationV0.Annotation) (annotationV0.Annotation, error)
	Delete(context.Context, string) error
	Cleanup(context.Context) error
}

type InMemoryStorage struct {
	items map[string]annotationV0.Annotation
}

func NewInMemoryStorage() *InMemoryStorage {
	return &InMemoryStorage{
		items: make(map[string]annotationV0.Annotation),
	}
}

func (s *InMemoryStorage) List(ctx context.Context, options ListOptions) ([]annotationV0.Annotation, error) {
	var result []annotationV0.Annotation
	for _, item := range s.items {
		if options.DashboardUID != "" && (item.Spec.DashboardUID == nil || *item.Spec.DashboardUID != options.DashboardUID) {
			continue
		}
		if options.PanelID != 0 && (item.Spec.PanelID == nil || *item.Spec.PanelID != options.PanelID) {
			continue
		}
		// TODO: check bounds
		if options.From != 0 && item.Spec.Time < options.From {
			continue
		}
		if options.To != 0 && item.Spec.TimeEnd != nil && *item.Spec.TimeEnd < options.To {
			continue
		}
		result = append(result, item)
	}
	return result, nil
}

func (s *InMemoryStorage) Create(ctx context.Context, annotation annotationV0.Annotation) error {
	s.items[annotation.Name] = annotation
	return nil
}

func (s *InMemoryStorage) Update(ctx context.Context, annotation annotationV0.Annotation) error {
	// TODO: verify versions, only allow text modifications
	s.items[annotation.Name] = annotation
	return nil
}

func (s *InMemoryStorage) Delete(ctx context.Context, name string) error {
	delete(s.items, name)
	return nil
}

func (s *InMemoryStorage) Cleanup(ctx context.Context) error {
	return nil
}

type RepositoryStorage struct {
	repo       annotations.Repository
	namespacer request.NamespaceMapper
}

func NewRepositoryStorage(repo annotations.Repository) *RepositoryStorage {
	return &RepositoryStorage{
		repo: repo,
	}
}

func (s *RepositoryStorage) List(ctx context.Context, options ListOptions) ([]annotationV0.Annotation, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	query := &annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        orgID,
		DashboardUID: options.DashboardUID,
		PanelID:      options.PanelID,
		From:         options.From,
		To:           options.To,
		Limit:        options.Limit,
		AlertID:      -1, // exclude alert annotations
	}
	items, err := s.repo.Find(ctx, query)
	if err != nil {
		return nil, err
	}
	var result []annotationV0.Annotation
	for _, item := range items {
		c, err := toK8sResource(orgID, item, s.namespacer)
		if err != nil {
			return nil, err
		}
		result = append(result, *c)
	}
	// TODO: pagination
	return result, nil
}

func (s *RepositoryStorage) Create(ctx context.Context, annotation annotationV0.Annotation) error {
	item := &annotations.Item{
		Text:  annotation.Spec.Text,
		Epoch: annotation.Spec.Time,
		Tags:  annotation.Spec.Tags,
	}
	if annotation.Spec.DashboardUID != nil {
		item.DashboardUID = *annotation.Spec.DashboardUID
	}
	if annotation.Spec.PanelID != nil {
		item.PanelID = *annotation.Spec.PanelID
	}
	if annotation.Spec.TimeEnd != nil {
		item.EpochEnd = *annotation.Spec.TimeEnd
	}
	if err := s.repo.Save(ctx, item); err != nil {
		return err
	}
	return nil
}

func (s *RepositoryStorage) Update(ctx context.Context, annotation annotationV0.Annotation) error {
	return errors.New("not implemented")
}

func (s *RepositoryStorage) Delete(ctx context.Context, name string) error {
	return errors.New("not implemented")
}

func (s *RepositoryStorage) Cleanup(ctx context.Context) error {
	return nil
}
