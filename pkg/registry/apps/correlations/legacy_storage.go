package correlations

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"

	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/correlations/legacy"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/correlations"
)

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
	service        correlations.Service
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
	sql            *legacy.LegacySQL
}

func (s *legacyStorage) New() runtime.Object {
	return correlationsV0.CorrelationKind().ZeroValue()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return strings.ToLower(correlationsV0.CorrelationKind().Kind())
}

func (s *legacyStorage) NewList() runtime.Object {
	return correlationsV0.CorrelationKind().ZeroListValue()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}
	uids := []string{}
	if options.FieldSelector != nil {
		for _, r := range options.FieldSelector.Requirements() {
			switch r.Field {
			case "spec.datasource.name":
				switch r.Operator {
				case selection.Equals, selection.DoubleEquals:
					uids = []string{r.Value}
				case selection.In:
					uids = strings.Split(r.Value, ";") // ??? not sure how/if this supports multiple values
				default:
					return nil, fmt.Errorf("unsupported operation")
				}
			default:
				return nil, fmt.Errorf("unsupported field")
			}
		}
	}
	return s.sql.List(ctx, orgID, "", uids)
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}
	res, err := s.sql.List(ctx, orgID, name, nil)
	if err != nil {
		return nil, err
	}
	if len(res.Items) == 1 {
		return &res.Items[0], nil
	}
	return nil, fmt.Errorf("not found")
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	resource, ok := obj.(*correlationsV0.Correlation)
	if !ok {
		return nil, fmt.Errorf("expected correlation")
	}

	tmp, err := correlations.ToCorrelation(resource)
	if err != nil {
		return nil, err
	}

	out, err := s.service.CreateCorrelation(ctx, correlations.CreateCorrelationCommand{
		OrgId:       orgID,
		SourceUID:   tmp.SourceUID,
		TargetUID:   tmp.TargetUID,
		Label:       tmp.Label,
		Description: tmp.Description,
		Config:      tmp.Config,
		Type:        tmp.Type,
		Provisioned: tmp.Provisioned,
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, out.UID, &metav1.GetOptions{})
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, false, err
	}

	before, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}
	obj, err := objInfo.UpdatedObject(ctx, before)
	if err != nil {
		return nil, false, err
	}

	resource, ok := obj.(*correlationsV0.Correlation)
	if !ok {
		return nil, false, fmt.Errorf("expected correlation")
	}

	tmp, err := correlations.ToCorrelation(resource)
	if err != nil {
		return nil, false, err
	}

	out, err := s.service.UpdateCorrelation(ctx, correlations.UpdateCorrelationCommand{
		UID:         tmp.UID,
		OrgId:       orgID,
		SourceUID:   tmp.SourceUID,
		Label:       &tmp.Label,
		Description: &tmp.Description,
		Type:        &tmp.Type,
		Config: &correlations.CorrelationConfigUpdateDTO{
			Field: &tmp.Config.Field,
			// TODO!!! more (or add a conversion?)
		},
	})
	if err != nil {
		return nil, false, err
	}
	obj, err = s.Get(ctx, out.UID, &metav1.GetOptions{})
	return obj, false, err
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, false, err
	}
	err = s.service.DeleteCorrelation(ctx, correlations.DeleteCorrelationCommand{
		OrgId: orgID,
		UID:   name,
	})
	return nil, (err == nil), err
}

// CollectionDeleter
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for shorturl not implemented")
}
