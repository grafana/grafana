package annotations

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	annotationsV0 "github.com/grafana/grafana/apps/annotations/pkg/apis/annotations/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/annotations"
)

type legacyService struct {
	repo           annotations.Repository // legacy
	tableConverter rest.TableConvertor
}

func newLegacyService(
	repo annotations.Repository,
) annotationsV0.Service {
	return &legacyService{
		repo: repo,
		tableConverter: rest.NewDefaultTableConvertor(
			schema.GroupResource{
				Group:    annotationsV0.APIGroup,
				Resource: "annotations",
			}),
	}
}

// Append implements annotationsV0.Service.
func (s *legacyService) Find(ctx context.Context, q *annotationsV0.AnnotationQuery) (*annotationsV0.AnnotationList, error) {
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

// Append implements annotationsV0.Service.
func (s *legacyService) Tags(ctx context.Context) (*annotationsV0.TagList, error) {
	result, err := s.repo.FindTags(ctx, &annotations.TagsQuery{Limit: 1000})
	if err != nil {
		return nil, err
	}
	obj := &annotationsV0.TagList{
		Items: make([]annotationsV0.TagCount, len(result.Tags)),
	}
	for i, t := range result.Tags {
		obj.Items[i] = annotationsV0.TagCount{
			Tag:   t.Tag,
			Count: t.Count,
		}
	}
	return obj, nil
}

// Append implements annotationsV0.Service.
func (s *legacyService) Append(ctx context.Context, spec []annotationsV0.AnnotationSpec) (*annotationsV0.AnnotationList, error) {
	items := make([]annotations.Item, len(spec))
	for i, item := range spec {
		v, err := toLegacyItem(ctx, &annotationsV0.Annotation{
			Spec: item,
		})
		if err != nil {
			return nil, err
		}
		items[i] = *v
	}
	if err := s.repo.SaveMany(ctx, items); err != nil {
		return nil, err
	}
	created := &annotationsV0.AnnotationList{
		Items: make([]annotationsV0.Annotation, len(items)),
	}
	for i, item := range items {
		v, err := itemToAnnotation(item)
		if err != nil {
			return nil, err
		}
		created.Items[i] = v
	}
	return created, nil
}

// Append implements annotationsV0.Service.
func (s *legacyService) Remove(ctx context.Context, name string) error {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return err
	}
	id, err := legacyIdFromName(name)
	if err != nil {
		return err
	}
	return s.repo.Delete(ctx, &annotations.DeleteParams{
		ID:    id,
		OrgID: user.GetOrgID(),
	})
}
