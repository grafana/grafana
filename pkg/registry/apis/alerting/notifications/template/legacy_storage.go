package template

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	notifications "github.com/grafana/grafana/pkg/apis/alerting/notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type TemplateService interface {
	GetTemplates(ctx context.Context, orgID int64) ([]definitions.NotificationTemplate, error)
	SetTemplate(ctx context.Context, orgID int64, tmpl definitions.NotificationTemplate) (definitions.NotificationTemplate, error)
	DeleteTemplate(ctx context.Context, orgID int64, name string) error
}

var resourceInfo = notifications.TemplateResourceInfo

type legacyStorage struct {
	service        TemplateService
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return resourceInfo.NewFunc()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

func (s *legacyStorage) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	res, err := s.service.GetTemplates(ctx, orgId)
	if err != nil {
		return nil, err
	}

	return convertToK8sResources(orgId, res, s.namespacer)
}

func (s *legacyStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	dto, err := s.service.GetTemplates(ctx, info.OrgID)
	if err != nil {
		return nil, err
	}
	for _, t := range dto {
		if t.Name == name {
			return convertToK8sResource(info.OrgID, t, s.namespacer), nil
		}
	}
	return nil, errors.NewNotFound(resourceInfo.SingularGroupResource(), name)
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
	p, ok := obj.(*notifications.Template)
	if !ok {
		return nil, fmt.Errorf("expected template but got %s", obj.GetObjectKind().GroupVersionKind())
	}
	out, err := s.service.SetTemplate(ctx, info.OrgID, convertToDomainModel(p))
	if err != nil {
		return nil, err
	}
	return convertToK8sResource(info.OrgID, out, s.namespacer), nil
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

	dtos, err := s.service.GetTemplates(ctx, info.OrgID)
	if err != nil {
		return nil, false, err
	}
	var old runtime.Object
	for _, t := range dtos {
		if t.Name == name {
			old = convertToK8sResource(info.OrgID, t, s.namespacer)
			break
		}
	}
	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, false, err
	}
	create := old == nil
	if create {
		if createValidation != nil {
			if err := createValidation(ctx, obj); err != nil {
				return nil, false, err
			}
		}
	} else {
		if updateValidation != nil {
			if err := updateValidation(ctx, obj, old); err != nil {
				return nil, false, err
			}
		}
	}
	p, ok := obj.(*notifications.Template)
	if !ok {
		return nil, false, fmt.Errorf("expected template but got %s", obj.GetObjectKind().GroupVersionKind())
	}

	domainModel := convertToDomainModel(p)
	updated, err := s.service.SetTemplate(ctx, info.OrgID, domainModel)
	if err != nil {
		return nil, false, err
	}

	r := convertToK8sResource(info.OrgID, updated, s.namespacer)
	return r, create, nil
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
	err = s.service.DeleteTemplate(ctx, info.OrgID, name) // TODO add support for dry-run option
	return old, false, err                                // false - will be deleted async
}
