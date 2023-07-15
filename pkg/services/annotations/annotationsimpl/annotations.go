package annotationsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/setting"
)

type RepositoryImpl struct {
	store store
}

func ProvideService(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tagService tag.Service) *RepositoryImpl {
	return &RepositoryImpl{
		store: &xormRepositoryImpl{
			cfg:               cfg,
			features:          features,
			db:                db,
			log:               log.New("annotations"),
			tagService:        tagService,
			maximumTagsLength: cfg.AnnotationMaximumTagsLength,
		},
	}
}

func (r *RepositoryImpl) Save(ctx context.Context, item *annotations.Item) error {
	return r.store.Add(ctx, item)
}

// SaveMany inserts multiple annotations at once.
// It does not return IDs associated with created annotations. If you need this functionality, use the single-item Save instead.
func (r *RepositoryImpl) SaveMany(ctx context.Context, items []annotations.Item) error {
	return r.store.AddMany(ctx, items)
}

func (r *RepositoryImpl) Update(ctx context.Context, item *annotations.Item) error {
	return r.store.Update(ctx, item)
}

func (r *RepositoryImpl) Find(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	return r.store.Get(ctx, query)
}

func (r *RepositoryImpl) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	return r.store.Delete(ctx, params)
}

func (r *RepositoryImpl) FindTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return r.store.GetTags(ctx, query)
}
