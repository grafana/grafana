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

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

var (
	_ grafanarest.Storage = (*legacyStorage)(nil)
)

type TemplateService interface {
	GetTemplate(ctx context.Context, orgID int64, nameOrUid string) (v1.TemplateGroup, utils.ManagerProperties, error)
	GetTemplates(ctx context.Context, orgID int64) ([]v1.TemplateGroup, map[string]utils.ManagerProperties, error)
	CreateTemplate(ctx context.Context, orgID int64, tmpl v1.TemplateGroup, manager utils.ManagerProperties) (v1.TemplateGroup, error)
	UpdateTemplate(ctx context.Context, orgID int64, tmpl v1.TemplateGroup, manager utils.ManagerProperties) (v1.TemplateGroup, error)
	DeleteTemplate(ctx context.Context, orgID int64, nameOrUid string, manager utils.ManagerProperties, version string) error
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

	res, managerProps, err := s.service.GetTemplates(ctx, orgId)
	if err != nil {
		return nil, err
	}

	defaultTemplate, err := s.defaultTemplate()
	if err != nil {
		return nil, err
	}

	return convertToK8sResources(orgId, append([]v1.TemplateGroup{defaultTemplate}, res...), managerProps, s.namespacer, opts.FieldSelector)
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
		return convertToK8sResource(info.OrgID, dto, utils.ManagerProperties{}, s.namespacer), nil
	}

	dto, manager, err := s.service.GetTemplate(ctx, info.OrgID, name)
	if err != nil {
		return nil, err
	}
	return convertToK8sResource(info.OrgID, dto, manager, s.namespacer), nil
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
	if p.Name != "" { // TODO remove when metadata.name can be defined by user
		return nil, errors.NewBadRequest("object's metadata.name should be empty")
	}
	domainModel, manager, err := convertToDomainModel(p)
	if err != nil {
		return nil, errors.NewBadRequest(err.Error())
	}
	out, err := s.service.CreateTemplate(ctx, info.OrgID, domainModel, manager)
	if err != nil {
		return nil, err
	}
	return convertToK8sResource(info.OrgID, out, manager, s.namespacer), nil
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

	dto, oldManager, err := s.service.GetTemplate(ctx, info.OrgID, name)
	if err != nil {
		return nil, false, err
	}
	old := convertToK8sResource(info.OrgID, dto, oldManager, s.namespacer)

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

	domainModel, manager, err := convertToDomainModel(p)
	if err != nil {
		return nil, false, errors.NewBadRequest(err.Error())
	}
	updated, err := s.service.UpdateTemplate(ctx, info.OrgID, domainModel, manager)
	if err != nil {
		return nil, false, err
	}

	r := convertToK8sResource(info.OrgID, updated, manager, s.namespacer)
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
	oldTemplate, ok := old.(*model.TemplateGroup)
	if !ok {
		return nil, false, fmt.Errorf("expected template but got %s", old.GetObjectKind().GroupVersionKind())
	}
	prov, err := ngmodels.ProvenanceFromString(oldTemplate.GetProvenanceStatus())
	if err != nil {
		return nil, false, errors.NewBadRequest(err.Error())
	}
	// Prefer the richer manager from the object's annotations so a resource managed by a
	// specific manager (e.g. Terraform) is deleted with the matching manager; fall back to provenance.
	manager := ngmodels.ProvenanceToManagerProperties(prov)
	if meta, mErr := utils.MetaAccessor(oldTemplate); mErr == nil {
		if mp, ok := meta.GetManagerProperties(); ok {
			manager = mp
		}
	}
	err = s.service.DeleteTemplate(ctx, info.OrgID, name, manager, version) // TODO add support for dry-run option
	return old, false, err                                                  // false - will be deleted async
}

func (s *legacyStorage) defaultTemplate() (v1.TemplateGroup, error) {
	// Omit some templates that we do not want to use to see.
	defaultTemplate, err := templates.DefaultTemplate(templates.DefaultTemplatesToOmit)
	if err != nil {
		return v1.TemplateGroup{}, err
	}

	dto := v1.TemplateGroup{
		Title: model.DefaultTemplateTitle, // User friendly name.
		ResourceMetadata: v1.ResourceMetadata{
			UID:        v1.ResourceUID(defaultTemplate.Name),
			Provenance: ngmodels.Provenance("system"),
		},
		Content: defaultTemplate.Template,
		Kind:    v1.TemplateKindGrafana,
	}

	return dto, nil
}
