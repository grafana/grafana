package templategroup

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/alerting/templates"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/templategroup/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	_ grafanarest.Storage = (*legacyStorage)(nil)
)

type TemplateService interface {
	GetTemplate(ctx context.Context, orgID int64, nameOrUid string) (definitions.NotificationTemplate, error)
	GetTemplates(ctx context.Context, orgID int64) ([]definitions.NotificationTemplate, error)
	CreateTemplate(ctx context.Context, orgID int64, tmpl definitions.NotificationTemplate) (definitions.NotificationTemplate, error)
	UpdateTemplate(ctx context.Context, orgID int64, tmpl definitions.NotificationTemplate) (definitions.NotificationTemplate, error)
	DeleteTemplate(ctx context.Context, orgID int64, nameOrUid string, provenance definitions.Provenance, version string) error
}

type legacyStorage struct {
	service        TemplateService
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) DeleteCollection(context.Context, rest.ValidateObjectFunc, *metav1.DeleteOptions, *internalversion.ListOptions) (runtime.Object, error) {
	return nil, errors.NewMethodNotSupported(ResourceInfo.GroupResource(), "deleteCollection")
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

	res, err := s.service.GetTemplates(ctx, orgId)
	if err != nil {
		return nil, err
	}

	defaultTemplate, err := s.defaultTemplate()
	if err != nil {
		return nil, err
	}

	return convertToK8sResources(orgId, append([]definitions.NotificationTemplate{defaultTemplate}, res...), s.namespacer, opts.FieldSelector)
}

func (s *legacyStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	if name == templates.DefaultTemplateName {
		dto, err := s.defaultTemplate()
		if err != nil {
			return nil, err
		}
		return convertToK8sResource(info.OrgID, dto, s.namespacer), nil
	}

	dto, err := s.service.GetTemplate(ctx, info.OrgID, name)
	if err != nil {
		return nil, err
	}
	return convertToK8sResource(info.OrgID, dto, s.namespacer), nil
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
	p, ok := obj.(*model.TemplateGroup)
	if !ok {
		return nil, fmt.Errorf("expected template but got %s", obj.GetObjectKind().GroupVersionKind())
	}
	if p.ObjectMeta.Name != "" { // TODO remove when metadata.name can be defined by user
		return nil, errors.NewBadRequest("object's metadata.name should be empty")
	}
	out, err := s.service.CreateTemplate(ctx, info.OrgID, convertToDomainModel(p))
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

	dto, err := s.service.GetTemplate(ctx, info.OrgID, name)
	if err != nil {
		return nil, false, err
	}
	old := convertToK8sResource(info.OrgID, dto, s.namespacer)

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, false, err
	}

	if updateValidation != nil {
		if err := updateValidation(ctx, obj, old); err != nil {
			return nil, false, err
		}
	}

	p, ok := obj.(*model.TemplateGroup)
	if !ok {
		return nil, false, fmt.Errorf("expected template but got %s", obj.GetObjectKind().GroupVersionKind())
	}

	domainModel := convertToDomainModel(p)
	updated, err := s.service.UpdateTemplate(ctx, info.OrgID, domainModel)
	if err != nil {
		return nil, false, err
	}

	r := convertToK8sResource(info.OrgID, updated, s.namespacer)
	return r, false, nil
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
	version := ""
	if options.Preconditions != nil && options.Preconditions.ResourceVersion != nil {
		version = *options.Preconditions.ResourceVersion
	}
	if deleteValidation != nil {
		if err = deleteValidation(ctx, old); err != nil {
			return nil, false, err
		}
	}
	err = s.service.DeleteTemplate(ctx, info.OrgID, name, definitions.Provenance(models.ProvenanceNone), version) // TODO add support for dry-run option
	return old, false, err                                                                                        // false - will be deleted async
}

func (s *legacyStorage) defaultTemplate() (definitions.NotificationTemplate, error) {
	defaultTemplate, err := templates.DefaultTemplate()
	if err != nil {
		return definitions.NotificationTemplate{}, err
	}

	dto := definitions.NotificationTemplate{
		Name:       model.DefaultTemplateTitle, // User friendly name.
		UID:        defaultTemplate.Name,
		Provenance: definitions.Provenance("system"),
		Template:   defaultTemplate.Template,
	}

	return dto, nil
}
