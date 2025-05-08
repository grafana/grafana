package timeinterval

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alerting/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	_ grafanarest.Storage = (*legacyStorage)(nil)
)

type TimeIntervalService interface {
	GetMuteTimings(ctx context.Context, orgID int64) ([]definitions.MuteTimeInterval, error)
	CreateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (definitions.MuteTimeInterval, error)
	UpdateMuteTiming(ctx context.Context, mt definitions.MuteTimeInterval, orgID int64) (definitions.MuteTimeInterval, error)
	DeleteMuteTiming(ctx context.Context, nameOrUid string, orgID int64, provenance definitions.Provenance, version string) error
}

type legacyStorage struct {
	service        TimeIntervalService
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

	res, err := s.service.GetMuteTimings(ctx, orgId)
	if err != nil {
		return nil, err
	}

	return ConvertToK8sResources(orgId, res, s.namespacer, opts.FieldSelector)
}

func (s *legacyStorage) Get(ctx context.Context, uid string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	timings, err := s.service.GetMuteTimings(ctx, info.OrgID)
	if err != nil {
		return nil, err
	}

	for _, mt := range timings {
		if mt.UID == uid {
			return ConvertToK8sResource(info.OrgID, mt, s.namespacer)
		}
	}
	return nil, errors.NewNotFound(ResourceInfo.GroupResource(), uid)
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
	p, ok := obj.(*model.TimeInterval)
	if !ok {
		return nil, fmt.Errorf("expected time-interval but got %s", obj.GetObjectKind().GroupVersionKind())
	}
	if p.Name != "" { // TODO remove when metadata.name can be defined by user
		return nil, errors.NewBadRequest("object's metadata.name should be empty")
	}
	model, err := convertToDomainModel(p)
	if err != nil {
		return nil, err
	}
	out, err := s.service.CreateMuteTiming(ctx, model, info.OrgID)
	if err != nil {
		return nil, err
	}
	return ConvertToK8sResource(info.OrgID, out, s.namespacer)
}

func (s *legacyStorage) Update(ctx context.Context,
	uid string,
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

	old, err := s.Get(ctx, uid, nil)
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
	p, ok := obj.(*model.TimeInterval)
	if !ok {
		return nil, false, fmt.Errorf("expected time-interval but got %s", obj.GetObjectKind().GroupVersionKind())
	}
	interval, err := convertToDomainModel(p)
	if err != nil {
		return old, false, err
	}

	if p.Name != interval.UID {
		return nil, false, errors.NewBadRequest("title of cannot be changed. Consider creating a new resource.")
	}

	updated, err := s.service.UpdateMuteTiming(ctx, interval, info.OrgID)
	if err != nil {
		return nil, false, err
	}

	r, err := ConvertToK8sResource(info.OrgID, updated, s.namespacer)
	return r, false, err
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, uid string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	old, err := s.Get(ctx, uid, nil)
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
	p, ok := old.(*model.TimeInterval)
	if !ok {
		return nil, false, fmt.Errorf("expected time-interval but got %s", old.GetObjectKind().GroupVersionKind())
	}

	err = s.service.DeleteMuteTiming(ctx, p.Name, info.OrgID, definitions.Provenance(ngmodels.ProvenanceNone), version) // TODO add support for dry-run option
	return old, false, err                                                                                              // false - will be deleted async
}

func (s *legacyStorage) DeleteCollection(context.Context, rest.ValidateObjectFunc, *metav1.DeleteOptions, *internalversion.ListOptions) (runtime.Object, error) {
	return nil, errors.NewMethodNotSupported(ResourceInfo.GroupResource(), "deleteCollection")
}
