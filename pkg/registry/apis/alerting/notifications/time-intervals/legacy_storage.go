package time_intervals

import (
	"context"
	"fmt"

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

var resourceInfo = notifications.TimeIntervalResourceInfo

type TimeIntervalService interface {
	GetMuteTimings(ctx context.Context, orgID int64) ([]definitions.MuteTimeInterval, error)
	GetMuteTiming(ctx context.Context, name string, orgID int64) (definitions.MuteTimeInterval, error)
	CreateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (definitions.MuteTimeInterval, error)
	UpdateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (definitions.MuteTimeInterval, error)
	DeleteMuteTiming(ctx context.Context, name string, orgID int64) error
}

type legacyStorage struct {
	service        TimeIntervalService
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

	res, err := s.service.GetMuteTimings(ctx, orgId)
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

	dto, err := s.service.GetMuteTiming(ctx, name, info.OrgID)
	if err != nil {
		return nil, err
	}
	return convertToK8sResource(info.OrgID, dto, s.namespacer)
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
	p, ok := obj.(*notifications.TimeInterval)
	if !ok {
		return nil, fmt.Errorf("expected time-interval but got %s", obj.GetObjectKind().GroupVersionKind())
	}
	model, err := convertToDomainModel(p)
	if err != nil {
		return nil, err
	}
	out, err := s.service.CreateMuteTiming(ctx, model, info.OrgID)
	if err != nil {
		return nil, err
	}
	return convertToK8sResource(info.OrgID, out, s.namespacer)
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

	// TODO use preconditions to check version
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
	p, ok := obj.(*notifications.TimeInterval)
	if !ok {
		return nil, false, fmt.Errorf("expected time-interval but got %s", obj.GetObjectKind().GroupVersionKind())
	}

	interval, err := convertToDomainModel(p)
	if err != nil {
		return old, false, err
	}
	updated, err := s.service.UpdateMuteTiming(ctx, interval, info.OrgID)
	if err != nil {
		return nil, false, err
	}

	r, err := convertToK8sResource(info.OrgID, updated, s.namespacer)
	return r, false, err
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
	err = s.service.DeleteMuteTiming(ctx, name, info.OrgID) // TODO add support for dry-run option
	return old, false, err                                  // false - will be deleted async
}
