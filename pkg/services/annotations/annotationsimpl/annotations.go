package annotationsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/setting"
)

type RepositoryImpl struct {
	db       db.DB
	authZ    *accesscontrol.AuthService
	features featuremgmt.FeatureToggles
	store    store
}

func ProvideService(
	db db.DB,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	tagService tag.Service,
) *RepositoryImpl {
	l := log.New("annotations")

	return &RepositoryImpl{
		db:       db,
		features: features,
		authZ:    accesscontrol.NewAuthService(db, features),
		store:    NewXormStore(cfg, l, db, tagService),
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
	resources, err := r.authZ.Authorize(ctx, query.OrgID, query)
	if err != nil {
		return make([]*annotations.ItemDTO, 0), err
	}

	return r.store.Get(ctx, query, resources)
}

func (r *RepositoryImpl) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	return r.store.Delete(ctx, params)
}

func (r *RepositoryImpl) FindTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return r.store.GetTags(ctx, query)
}
