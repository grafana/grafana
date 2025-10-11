package app

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	v0alpha1 "github.com/grafana/grafana/apps/annotations/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/annotations"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Storage              = (*LegacyAnnotationStorage)(nil)
	_ rest.Scoper               = (*LegacyAnnotationStorage)(nil)
	_ rest.SingularNameProvider = (*LegacyAnnotationStorage)(nil)
	_ rest.Getter               = (*LegacyAnnotationStorage)(nil)
	_ rest.Lister               = (*LegacyAnnotationStorage)(nil)
	_ rest.TableConvertor       = (*LegacyAnnotationStorage)(nil)
	_ rest.Creater              = (*LegacyAnnotationStorage)(nil)
	_ rest.Updater              = (*LegacyAnnotationStorage)(nil)
	_ rest.GracefulDeleter      = (*LegacyAnnotationStorage)(nil)
	_ rest.CollectionDeleter    = (*LegacyAnnotationStorage)(nil)
)

type LegacyAnnotationStorage struct {
	legacyService  annotations.Repository
	tableConverter rest.TableConvertor
}

func NewLegacyAnnotationStorage(legacyService annotations.Repository) *LegacyAnnotationStorage {
	return &LegacyAnnotationStorage{
		legacyService: legacyService,
	}
}

func (s *LegacyAnnotationStorage) SetTableConverter(converter rest.TableConvertor) {
	s.tableConverter = converter
}

func (s *LegacyAnnotationStorage) New() runtime.Object {
	return &v0alpha1.Annotation{}
}

func (s *LegacyAnnotationStorage) NewList() runtime.Object {
	return &v0alpha1.AnnotationList{}
}

func (s *LegacyAnnotationStorage) Destroy() {
}

func (s *LegacyAnnotationStorage) NamespaceScoped() bool {
	return true
}

func (s *LegacyAnnotationStorage) GetSingularName() string {
	return strings.ToLower(v0alpha1.AnnotationKind().Kind())
}

func (s *LegacyAnnotationStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	if s.tableConverter != nil {
		return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
	}
	return rest.NewDefaultTableConvertor(schema.GroupResource{
		Group:    "annotation.grafana.app",
		Resource: "annotations",
	}).ConvertToTable(ctx, object, tableOptions)
}

func (s *LegacyAnnotationStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	annotationID, err := s.parseAnnotationID(name)
	if err != nil {
		return nil, apierrors.NewBadRequest("invalid annotation name: " + err.Error())
	}

	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, apierrors.NewBadRequest("namespace not found in context")
	}

	orgID, err := ExtractOrgIDFromNamespace(namespace)
	if err != nil {
		return nil, apierrors.NewBadRequest("invalid namespace: " + err.Error())
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, apierrors.NewUnauthorized("could not get user from context")
	}

	query := &annotations.ItemQuery{
		OrgID:        orgID,
		AnnotationID: annotationID,
		SignedInUser: user,
		Limit:        1,
	}

	items, err := s.legacyService.Find(ctx, query)
	if err != nil {
		return nil, apierrors.NewInternalError(err)
	}

	if len(items) == 0 {
		return nil, apierrors.NewNotFound(schema.GroupResource{
			Group:    "annotation.grafana.app",
			Resource: "annotations",
		}, name)
	}

	annotation, err := ConvertLegacyAnnotationToK8s(items[0], orgID)
	if err != nil {
		return nil, apierrors.NewInternalError(err)
	}

	return annotation, nil
}

func (s *LegacyAnnotationStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, apierrors.NewBadRequest("namespace not found in context")
	}

	orgID, err := ExtractOrgIDFromNamespace(namespace)
	if err != nil {
		return nil, apierrors.NewBadRequest("invalid namespace: " + err.Error())
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, apierrors.NewUnauthorized("could not get user from context")
	}

	query := &annotations.ItemQuery{
		OrgID:        orgID,
		SignedInUser: user,
		Limit:        100,
	}

	if options.Limit > 0 {
		query.Limit = options.Limit
	}

	items, err := s.legacyService.Find(ctx, query)
	if err != nil {
		return nil, apierrors.NewInternalError(err)
	}

	annotations := make([]v0alpha1.Annotation, 0, len(items))
	for _, item := range items {
		annotation, err := ConvertLegacyAnnotationToK8s(item, orgID)
		if err != nil {
			continue
		}
		annotations = append(annotations, *annotation)
	}

	return &v0alpha1.AnnotationList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: v0alpha1.GroupVersion.String(),
			Kind:       "AnnotationList",
		},
		Items: annotations,
	}, nil
}

func (s *LegacyAnnotationStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	annotation, ok := obj.(*v0alpha1.Annotation)
	if !ok {
		return nil, apierrors.NewBadRequest("expected annotation object")
	}

	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, apierrors.NewBadRequest("namespace not found in context")
	}

	orgID, err := ExtractOrgIDFromNamespace(namespace)
	if err != nil {
		return nil, apierrors.NewBadRequest("invalid namespace: " + err.Error())
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, apierrors.NewUnauthorized("could not get user from context")
	}

	item, err := ConvertK8sAnnotationToLegacy(annotation, orgID)
	if err != nil {
		return nil, apierrors.NewBadRequest("invalid annotation: " + err.Error())
	}

	if userID, err := strconv.ParseInt(user.GetID(), 10, 64); err == nil {
		item.UserID = userID
	}

	legacyItem := ConvertItemDTOToItem(item, orgID)

	if err := s.legacyService.Save(ctx, legacyItem); err != nil {
		return nil, apierrors.NewInternalError(err)
	}

	item.ID = legacyItem.ID

	annotation.Name = strconv.FormatInt(item.ID, 10)
	annotation.Namespace = GenerateNamespaceFromOrgID(orgID)

	return annotation, nil
}

func (s *LegacyAnnotationStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, apierrors.NewMethodNotSupported(schema.GroupResource{
		Group:    "annotation.grafana.app",
		Resource: "annotations",
	}, "update")
}

func (s *LegacyAnnotationStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, apierrors.NewMethodNotSupported(schema.GroupResource{
		Group:    "annotation.grafana.app",
		Resource: "annotations",
	}, "delete")
}

func (s *LegacyAnnotationStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(schema.GroupResource{
		Group:    "annotation.grafana.app",
		Resource: "annotations",
	}, "deletecollection")
}

func (s *LegacyAnnotationStorage) parseAnnotationID(name string) (int64, error) {
	return strconv.ParseInt(name, 10, 64)
}

// Helper functions

func ExtractOrgIDFromNamespace(namespace string) (int64, error) {
	if strings.HasPrefix(namespace, "org-") {
		orgIDStr := strings.TrimPrefix(namespace, "org-")
		return strconv.ParseInt(orgIDStr, 10, 64)
	}
	return strconv.ParseInt(namespace, 10, 64)
}

func GenerateNamespaceFromOrgID(orgID int64) string {
	return fmt.Sprintf("org-%d", orgID)
}

func ConvertLegacyAnnotationToK8s(item *annotations.ItemDTO, orgID int64) (*v0alpha1.Annotation, error) {
	annotation := &v0alpha1.Annotation{
		ObjectMeta: metav1.ObjectMeta{
			Name:      strconv.FormatInt(item.ID, 10),
			Namespace: GenerateNamespaceFromOrgID(orgID),
		},
		Spec: v0alpha1.AnnotationSpec{
			Text: item.Text,
			Time: item.Time,
			Tags: item.Tags,
		},
	}

	// Set optional pointer fields
	if item.DashboardUID != nil && *item.DashboardUID != "" {
		annotation.Spec.DashboardUID = item.DashboardUID
	}
	if item.PanelID != 0 {
		annotation.Spec.PanelID = &item.PanelID
	}
	if item.TimeEnd != 0 {
		annotation.Spec.TimeEnd = &item.TimeEnd
	}
	if item.PrevState != "" {
		annotation.Spec.PrevState = &item.PrevState
	}
	if item.NewState != "" {
		annotation.Spec.NewState = &item.NewState
	}

	if item.Created > 0 {
		annotation.CreationTimestamp = metav1.Unix(item.Created/1000, (item.Created%1000)*1000000)
	}

	return annotation, nil
}

func ConvertK8sAnnotationToLegacy(annotation *v0alpha1.Annotation, orgID int64) (*annotations.ItemDTO, error) {
	id, err := strconv.ParseInt(annotation.Name, 10, 64)
	if err != nil {
		id = 0
	}

	item := &annotations.ItemDTO{
		ID:           id,
		Text:         annotation.Spec.Text,
		Time:         annotation.Spec.Time,
		Tags:         annotation.Spec.Tags,
		DashboardUID: annotation.Spec.DashboardUID,
	}

	// Convert optional pointer fields
	if annotation.Spec.PanelID != nil {
		item.PanelID = *annotation.Spec.PanelID
	}
	if annotation.Spec.TimeEnd != nil {
		item.TimeEnd = *annotation.Spec.TimeEnd
	}
	if annotation.Spec.PrevState != nil {
		item.PrevState = *annotation.Spec.PrevState
	}
	if annotation.Spec.NewState != nil {
		item.NewState = *annotation.Spec.NewState
	}

	// Convert timestamps
	if !annotation.CreationTimestamp.IsZero() {
		item.Created = annotation.CreationTimestamp.Unix() * 1000
	}
	return item, nil
}

func ConvertItemDTOToItem(dto *annotations.ItemDTO, orgID int64) *annotations.Item {
	item := &annotations.Item{
		ID:        dto.ID,
		OrgID:     orgID,
		UserID:    dto.UserID,
		PanelID:   dto.PanelID,
		Text:      dto.Text,
		AlertID:   dto.AlertID,
		PrevState: dto.PrevState,
		NewState:  dto.NewState,
		Epoch:     dto.Time,
		EpochEnd:  dto.TimeEnd,
		Created:   dto.Created,
		Updated:   dto.Updated,
		Tags:      dto.Tags,
	}

	if dto.DashboardUID != nil {
		item.DashboardUID = *dto.DashboardUID
	}

	return item
}
