package annotations

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
)

var (
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Lister               = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)

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

	return toAnnotationList(dto, s.namespacer)
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
	return nil, fmt.Errorf("not implemented")
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("not implemented")
}
