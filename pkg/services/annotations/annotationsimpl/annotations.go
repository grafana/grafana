package annotationsimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations/annotationsimpl/loki"

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
	reader   readStore
	writer   writeStore
}

func ProvideService(
	db db.DB,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	tagService tag.Service,
) *RepositoryImpl {
	l := log.New("annotations")
	l.Debug("Initializing annotations service")

	xormStore := NewXormStore(cfg, log.New("annotations.sql"), db, tagService)
	write := xormStore

	var read readStore
	historianStore := loki.NewLokiHistorianStore(cfg.UnifiedAlerting.StateHistory, features, db, log.New("annotations.loki"))
	if historianStore != nil {
		l.Debug("Using composite read store")
		read = NewCompositeStore(log.New("annotations.composite"), xormStore, historianStore)
	} else {
		l.Debug("Using xorm read store")
		read = write
	}

	return &RepositoryImpl{
		db:       db,
		features: features,
		authZ:    accesscontrol.NewAuthService(db, features),
		reader:   read,
		writer:   write,
	}
}

func (r *RepositoryImpl) Save(ctx context.Context, item *annotations.Item) error {
	return r.writer.Add(ctx, item)
}

// SaveMany inserts multiple annotations at once.
// It does not return IDs associated with created annotations. If you need this functionality, use the single-item Save instead.
func (r *RepositoryImpl) SaveMany(ctx context.Context, items []annotations.Item) error {
	return r.writer.AddMany(ctx, items)
}

func (r *RepositoryImpl) Update(ctx context.Context, item *annotations.Item) error {
	return r.writer.Update(ctx, item)
}

func (r *RepositoryImpl) Find(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	resources, err := r.authZ.Authorize(ctx, query.OrgID, query)
	if err != nil {
		return make([]*annotations.ItemDTO, 0), err
	}

	return r.reader.Get(ctx, query, resources)
}

func (r *RepositoryImpl) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	return r.writer.Delete(ctx, params)
}

func (r *RepositoryImpl) FindTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return r.reader.GetTags(ctx, query)
}
