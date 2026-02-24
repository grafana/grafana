package inhibitionrule

import (
	"context"
	stderrors "errors"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

var _ grafanarest.Storage = (*legacyStorage)(nil)

// InhibitionRuleService defines the interface for inhibition rule operations
type InhibitionRuleService interface {
	GetInhibitionRules(ctx context.Context, orgID int64) ([]definitions.InhibitionRule, error)
	GetInhibitionRule(ctx context.Context, name string, orgID int64) (definitions.InhibitionRule, error)
	CreateInhibitionRule(ctx context.Context, rule definitions.InhibitionRule, orgID int64) (definitions.InhibitionRule, error)
	UpdateInhibitionRule(ctx context.Context, name string, rule definitions.InhibitionRule, version string, orgID int64) (definitions.InhibitionRule, error)
	DeleteInhibitionRule(ctx context.Context, name string, orgID int64, provenance ngmodels.Provenance, version string) error
}

type legacyStorage struct {
	service        InhibitionRuleService
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return ResourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return ResourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return ResourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	res, err := s.service.GetInhibitionRules(ctx, orgId)
	if err != nil {
		return nil, err
	}

	return ConvertToK8sResources(orgId, res, s.namespacer, opts.FieldSelector), nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	rule, err := s.service.GetInhibitionRule(ctx, name, info.OrgID)
	if err != nil {
		if stderrors.Is(err, ngmodels.ErrInhibitionRuleNotFound) {
			return nil, errors.NewNotFound(ResourceInfo.GroupResource(), name)
		}
		return nil, err
	}

	return ConvertToK8sResource(info.OrgID, rule, s.namespacer), nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	_ *metav1.CreateOptions,
) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	if createValidation != nil {
		if err := createValidation(ctx, obj.DeepCopyObject()); err != nil {
			return nil, err
		}
	}
	p, ok := obj.(*model.InhibitionRule)
	if !ok {
		return nil, fmt.Errorf("expected inhibition-rule but got %s", obj.GetObjectKind().GroupVersionKind())
	}

	domainModel, err := convertToDomainModel(p)
	if err != nil {
		return nil, err
	}
	out, err := s.service.CreateInhibitionRule(ctx, domainModel, info.OrgID)
	if err != nil {
		return nil, err
	}
	return ConvertToK8sResource(info.OrgID, out, s.namespacer), nil
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	_ bool,
	_ *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, false, err
	}
	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, false, err
	}
	if updateValidation != nil {
		if err := updateValidation(ctx, obj, old); err != nil {
			return nil, false, err
		}
	}
	p, ok := obj.(*model.InhibitionRule)
	if !ok {
		return nil, false, fmt.Errorf("expected inhibition-rule but got %s", obj.GetObjectKind().GroupVersionKind())
	}

	rule, err := convertToDomainModel(p)
	if err != nil {
		return old, false, err
	}

	updated, err := s.service.UpdateInhibitionRule(ctx, name, rule, p.ResourceVersion, info.OrgID)
	if err != nil {
		return nil, false, err
	}

	return ConvertToK8sResource(info.OrgID, updated, s.namespacer), false, nil
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, false, err
	}
	if deleteValidation != nil {
		if err = deleteValidation(ctx, old); err != nil {
			return nil, false, err
		}
	}
	version := ""
	if options.Preconditions != nil && options.Preconditions.ResourceVersion != nil {
		version = *options.Preconditions.ResourceVersion
	}
	p, ok := old.(*model.InhibitionRule)
	if !ok {
		return nil, false, fmt.Errorf("expected inhibition-rule but got %s", old.GetObjectKind().GroupVersionKind())
	}

	err = s.service.DeleteInhibitionRule(ctx, p.Name, info.OrgID, ngmodels.ProvenanceNone, version)
	return old, false, err // false - will be deleted async
}

func (s *legacyStorage) DeleteCollection(context.Context, rest.ValidateObjectFunc, *metav1.DeleteOptions, *internalversion.ListOptions) (runtime.Object, error) {
	return nil, errors.NewMethodNotSupported(ResourceInfo.GroupResource(), "deleteCollection")
}
