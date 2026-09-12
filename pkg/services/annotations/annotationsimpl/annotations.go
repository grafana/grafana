package annotationsimpl

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/services/annotations/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations/annotationsimpl/loki"
	"github.com/grafana/grafana/pkg/services/dashboards"
	alertingStore "github.com/grafana/grafana/pkg/services/ngalert/store"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/setting"
)

type RepositoryImpl struct {
	authZ    accesscontrol.Authorizer
	features featuremgmt.FeatureToggles
	reader   ReadStore
	writer   WriteStore
}

func NewRepositoryImpl(authZ accesscontrol.Authorizer, features featuremgmt.FeatureToggles, reader ReadStore, writer WriteStore) *RepositoryImpl {
	return &RepositoryImpl{
		authZ:    authZ,
		features: features,
		reader:   reader,
		writer:   writer,
	}
}

func ProvideService(
	db db.DB,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	tagService tag.Service,
	tracer tracing.Tracer,
	ruleStore *alertingStore.DBstore,
	dashSvc dashboards.DashboardService,
	reg prometheus.Registerer,
) *RepositoryImpl {
	l := log.New("annotations")
	l.Debug("Initializing annotations service")

	xormStore := NewXormStore(cfg, log.New("annotations.sql"), db, tagService, reg)
	write := xormStore

	var read ReadStore
	historianStore := loki.NewLokiHistorianStore(cfg.UnifiedAlerting.StateHistory, db, ruleStore, log.New("annotations.loki"), tracer, reg)
	if historianStore != nil {
		l.Debug("Using composite read store")
		read = NewCompositeStore(log.New("annotations.composite"), xormStore, historianStore)
	} else {
		l.Debug("Using xorm read store")
		read = write
	}

	return NewRepositoryImpl(
		accesscontrol.NewAuthService(db, features, dashSvc, cfg),
		features,
		read,
		write,
	)
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
	// Create a copy of the query to avoid modifying the original
	q := *query
	if q.Limit == 0 {
		q.Limit = 100
	}

	// Search without dashboard UID filter is expensive, so check without access control first
	// nolint: staticcheck
	if q.DashboardID == 0 && q.DashboardUID == "" {
		// Return early if no annotations found, it's not necessary to perform expensive access control filtering
		res, err := r.reader.Get(ctx, q, &accesscontrol.AccessResources{
			SkipAccessControlFilter: true,
		})
		if err != nil || len(res) == 0 {
			return []*annotations.ItemDTO{}, err
		}
		// If number of resources is less than limit, it makes sense to set query limit to this
		// value, otherwise query will be iterating over all user's dashboards since original
		// query limit is never reached.
		q.Limit = int64(len(res))
	}

	results := make([]*annotations.ItemDTO, 0, q.Limit)
	// Page paginates dashboards (used in Authorize → SearchDashboards), not annotation rows (store uses Limit/Offset).
	q.Page = 1

	// Iterate over available annotations until query limit is reached
	// or all available dashboards are checked
	for len(results) < int(q.Limit) {
		resources, err := r.authZ.Authorize(ctx, q)
		if err != nil {
			return nil, err
		}

		res, err := r.reader.Get(ctx, q, resources)
		if err != nil {
			return nil, err
		}

		results = append(results, res...)
		q.Page++ // next iteration fetches the next page of dashboards
		// All user's dashboards are fetched
		if len(resources.Dashboards) < int(q.Limit) {
			break
		}
	}

	return results, nil
}

func (r *RepositoryImpl) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	return r.writer.Delete(ctx, params)
}

func (r *RepositoryImpl) FindTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return r.reader.GetTags(ctx, *query)
}
