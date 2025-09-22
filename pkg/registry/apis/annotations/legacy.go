package annotations

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
)

var (
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)

	_ v0alpha1.BasicService = (*legacyStorage)(nil)
)

type legacyStorage struct {
	repo           annotations.Repository // legacy
	ac             accesscontrol.AccessControl
	namespacer     authlib.NamespaceFormatter
	tableConverter rest.TableConvertor
}

func newLegacyStorage(
	ac accesscontrol.AccessControl,
	repo annotations.Repository,
	namespacer authlib.NamespaceFormatter,
) *legacyStorage {
	return &legacyStorage{
		repo:       repo,
		ac:         ac,
		namespacer: namespacer,
		tableConverter: rest.NewDefaultTableConvertor(
			schema.GroupResource{
				Group:    v0alpha1.APIGroup,
				Resource: "annotations",
			}),
	}
}

// Find implements v0alpha1.BasicService.
func (s *legacyStorage) Find(ctx context.Context, q *v0alpha1.ItemQuery) (*v0alpha1.AnnotationList, error) {
	query, err := toLegacyItemQuery(ctx, q)
	if err != nil {
		return nil, err
	}

	dto, err := s.repo.Find(ctx, query)
	if err != nil {
		return nil, err
	}

	return toAnnotationList(dto)
}

func (s *legacyStorage) Tags(ctx context.Context) (*v0alpha1.TagList, error) {
	result, err := s.repo.FindTags(ctx, &annotations.TagsQuery{Limit: 1000})
	if err != nil {
		return nil, err
	}
	obj := &v0alpha1.TagList{
		Items: make([]v0alpha1.TagCount, len(result.Tags)),
	}
	for i, t := range result.Tags {
		obj.Items[i] = v0alpha1.TagCount{
			Tag:   t.Tag,
			Count: t.Count,
		}
	}
	return obj, nil
}

// SaveMany implements v0alpha1.BasicService.
func (s *legacyStorage) SaveMany(ctx context.Context, items []v0alpha1.AnnotationSpec) error {
	panic("unimplemented")
}

func (s *legacyStorage) New() runtime.Object {
	return &v0alpha1.Annotation{}
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true
}

func (s *legacyStorage) GetSingularName() string {
	return "Annotation"
}

func (s *legacyStorage) NewList() runtime.Object {
	return &v0alpha1.AnnotationList{}
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	if options.Continue != "" {
		return nil, fmt.Errorf("pagination is not yet supported")
	}

	query, err := toLegacyItemQuery(ctx, &v0alpha1.ItemQuery{
		Limit: options.Limit,
	})
	if err != nil {
		return nil, err
	}

	dto, err := s.repo.Find(ctx, query)
	if err != nil {
		return nil, err
	}

	return toAnnotationList(dto)
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	query := &annotations.ItemQuery{
		OrgID:        user.GetOrgID(),
		SignedInUser: user,
	}
	query.AnnotationID, err = legacyIdFromName(name)
	if err != nil {
		return nil, err
	}

	dto, err := s.repo.Find(ctx, query)
	if err != nil {
		return nil, err
	}
	if len(dto) > 1 {
		return nil, fmt.Errorf("expected single item, got multiple")
	}
	if len(dto) == 0 {
		return nil, apierrors.NewNotFound(schema.GroupResource{
			Group:    v0alpha1.APIGroup,
			Resource: "annotations",
		}, name)
	}

	item, err := toAnnotation(dto[0])
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// Create implements rest.Creater.
func (s *legacyStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	v, ok := obj.(*v0alpha1.Annotation)
	if !ok {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("expected annotation, got %T", obj))
	}

	anno, err := toLegacyItem(ctx, v)
	if err != nil {
		return nil, err
	}

	if err = s.repo.Save(ctx, anno); err != nil {
		return nil, err
	}
	return s.Get(ctx, fmt.Sprintf("a%d", anno.ID), &metav1.GetOptions{})
}

// Delete implements rest.GracefulDeleter.
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	id, err := legacyIdFromName(name)
	if err != nil {
		return nil, false, err
	}
	err = s.repo.Delete(ctx, &annotations.DeleteParams{
		ID:    id,
		OrgID: user.GetOrgID(),
	})
	return nil, (err == nil), err
}

func legacyIdFromName(name string) (int64, error) {
	if !strings.HasPrefix(name, "a") {
		return 0, apierrors.NewBadRequest("invalid annotation name (expected to start with 'a')")
	}
	return strconv.ParseInt(name[1:], 10, 64)
}
