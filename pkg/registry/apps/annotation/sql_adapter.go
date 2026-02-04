package annotation

import (
	"context"
	"fmt"
	"strconv"

	claims "github.com/grafana/authlib/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

type sqlAdapter struct {
	repo     annotations.Repository
	cleaner  annotations.Cleaner
	nsMapper request.NamespaceMapper
	cfg      *setting.Cfg
}

func NewSQLAdapter(repo annotations.Repository, cleaner annotations.Cleaner, nsMapper request.NamespaceMapper, cfg *setting.Cfg) *sqlAdapter {
	return &sqlAdapter{
		repo:     repo,
		cleaner:  cleaner,
		nsMapper: nsMapper,
		cfg:      cfg,
	}
}

func (a *sqlAdapter) Get(ctx context.Context, namespace, name string) (*annotationV0.Annotation, error) {
	id, err := parseAnnotationID(name)
	if err != nil {
		return nil, err
	}

	orgID, err := namespaceToOrgID(ctx, namespace)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	query := &annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        orgID,
		Limit:        1000,
		AlertID:      -1,
	}

	items, err := a.repo.Find(ctx, query)
	if err != nil {
		return nil, err
	}

	for _, item := range items {
		if item.ID == id {
			return a.toK8sResource(item, namespace), nil
		}
	}

	return nil, fmt.Errorf("annotation not found")
}

func (a *sqlAdapter) List(ctx context.Context, namespace string, opts ListOptions) (*AnnotationList, error) {
	orgID, err := namespaceToOrgID(ctx, namespace)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	query := &annotations.ItemQuery{
		SignedInUser: user,
		OrgID:        orgID,
		DashboardUID: opts.DashboardUID,
		PanelID:      opts.PanelID,
		From:         opts.From,
		To:           opts.To,
		Limit:        opts.Limit,
		AlertID:      -1,
	}

	items, err := a.repo.Find(ctx, query)
	if err != nil {
		return nil, err
	}

	result := make([]annotationV0.Annotation, 0, len(items))
	for _, item := range items {
		result = append(result, *a.toK8sResource(item, namespace))
	}

	return &AnnotationList{
		Items:    result,
		Continue: "",
	}, nil
}

func (a *sqlAdapter) Create(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	orgID, err := namespaceToOrgID(ctx, anno.Namespace)
	if err != nil {
		return nil, err
	}

	item := a.fromK8sResource(anno)
	item.OrgID = orgID

	if err := a.repo.Save(ctx, item); err != nil {
		return nil, err
	}

	created := anno.DeepCopy()
	created.Name = fmt.Sprintf("a-%d", item.ID)

	return created, nil
}

func (a *sqlAdapter) Update(ctx context.Context, anno *annotationV0.Annotation) (*annotationV0.Annotation, error) {
	orgID, err := namespaceToOrgID(ctx, anno.Namespace)
	if err != nil {
		return nil, err
	}

	item := a.fromK8sResource(anno)
	item.OrgID = orgID

	if err := a.repo.Update(ctx, item); err != nil {
		return nil, err
	}

	return anno, nil
}

func (a *sqlAdapter) Delete(ctx context.Context, namespace, name string) error {
	id, err := parseAnnotationID(name)
	if err != nil {
		return err
	}

	orgID, err := namespaceToOrgID(ctx, namespace)
	if err != nil {
		return err
	}

	return a.repo.Delete(ctx, &annotations.DeleteParams{
		ID:    id,
		OrgID: orgID,
	})
}

func (a *sqlAdapter) Cleanup(ctx context.Context) (int64, error) {
	if a.cleaner == nil {
		return 0, nil
	}
	deleted, _, err := a.cleaner.Run(ctx, a.cfg)
	return deleted, err
}

func (a *sqlAdapter) ListTags(ctx context.Context, namespace string, opts TagListOptions) ([]Tag, error) {
	orgID, err := namespaceToOrgID(ctx, namespace)
	if err != nil {
		return nil, err
	}

	query := &annotations.TagsQuery{
		OrgID: orgID,
		Limit: int64(opts.Limit),
		Tag:   opts.Prefix,
	}

	result, err := a.repo.FindTags(ctx, query)
	if err != nil {
		return nil, err
	}

	tags := make([]Tag, len(result.Tags))
	for i, t := range result.Tags {
		tags[i] = Tag{Name: t.Tag, Count: t.Count}
	}
	return tags, nil
}

func (a *sqlAdapter) toK8sResource(item *annotations.ItemDTO, namespace string) *annotationV0.Annotation {
	anno := &annotationV0.Annotation{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("a-%d", item.ID),
			Namespace: namespace,
		},
		Spec: annotationV0.AnnotationSpec{
			Text: item.Text,
			Time: item.Time,
			Tags: item.Tags,
		},
	}

	if item.DashboardUID != nil && *item.DashboardUID != "" {
		anno.Spec.DashboardUID = item.DashboardUID
	}
	if item.PanelID != 0 {
		anno.Spec.PanelID = &item.PanelID
	}
	if item.TimeEnd != 0 {
		anno.Spec.TimeEnd = &item.TimeEnd
	}

	return anno
}

func (a *sqlAdapter) fromK8sResource(anno *annotationV0.Annotation) *annotations.Item {
	item := &annotations.Item{
		Text:  anno.Spec.Text,
		Epoch: anno.Spec.Time,
		Tags:  anno.Spec.Tags,
	}

	if anno.Name != "" {
		if id, err := parseAnnotationID(anno.Name); err == nil {
			item.ID = id
		}
	}

	if anno.Spec.DashboardUID != nil {
		item.DashboardUID = *anno.Spec.DashboardUID
	}
	if anno.Spec.PanelID != nil {
		item.PanelID = *anno.Spec.PanelID
	}
	if anno.Spec.TimeEnd != nil {
		item.EpochEnd = *anno.Spec.TimeEnd
	}

	return item
}

func parseAnnotationID(name string) (int64, error) {
	if len(name) < 3 || name[:2] != "a-" {
		return 0, fmt.Errorf("invalid annotation name format: %s", name)
	}
	return strconv.ParseInt(name[2:], 10, 64)
}

func namespaceToOrgID(ctx context.Context, namespace string) (int64, error) {
	info, err := claims.ParseNamespace(namespace)
	return info.OrgID, err
}
