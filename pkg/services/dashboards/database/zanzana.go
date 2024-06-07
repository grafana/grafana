package database

import (
	"context"
	"strings"
	"sync"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
)

// findDashboardsZanzana checks query conditions and pick one of the available search implementations
func (d *dashboardStore) findDashboardsZanzana(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	limit := int(query.Limit)
	if limit < 1 {
		limit = 1000
	}
	page := query.Page
	if page < 1 {
		page = 1
	}

	sb := d.buildZanzanaSearchQuery(ctx, query)
	var res []dashboards.DashboardSearchProjection

	sql, params := sb.ToSQL(int64(limit), page)
	err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(sql, params...).Find(&res)
	})
	if err != nil {
		return nil, err
	}

	if len(res) < limit {
		d.log.Info("searching using search then check strategy")
		return d.findDashboardsZanzanaCheck(ctx, query)
	}

	d.log.Info("searching using list then search strategy")
	return d.findDashboardsZanzanaListFilter(ctx, query)
}

func (d *dashboardStore) findDashboardsZanzanaCheck(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	sb := d.buildZanzanaSearchQuery(ctx, query)

	limit := int(query.Limit)
	if limit < 1 {
		limit = 1000
	}

	page := query.Page
	if page < 1 {
		page = 1
	}

	var res []dashboards.DashboardSearchProjection
	var fetchedRows int64
	for len(res) < limit {
		// Fetch a batch of rows
		batchSize := int64(limit - len(res))
		if batchSize > 1000 {
			batchSize = 1000
		}
		sql, params := sb.ToSQL(batchSize, fetchedRows/batchSize+1)

		var rowsFetchedInThisBatch int64
		err := d.store.WithDbSession(ctx, func(sess *db.Session) error {
			rows, err := sess.SQL(sql, params...).Rows(&dashboards.DashboardSearchProjection{})
			if err != nil {
				return err
			}

			batchRows := make([]dashboards.DashboardSearchProjection, 0)

			for rows.Next() {
				var row dashboards.DashboardSearchProjection
				if err := rows.Scan(&row); err != nil {
					return err
				}
				batchRows = append(batchRows, row)

				rowsFetchedInThisBatch++
			}

			concurrentRequests := int(d.zService.Cfg.MaxConcurrentReadsForCheck)
			if concurrentRequests == 0 {
				concurrentRequests = 10
			}
			rowsToCheck := make(chan dashboards.DashboardSearchProjection, concurrentRequests)
			allowedResults := make(chan dashboards.DashboardSearchProjection, len(batchRows))
			errChan := make(chan error, len(batchRows))
			var wg sync.WaitGroup
			for i := 0; i < concurrentRequests; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					for row := range rowsToCheck {
						object := "dashboard:" + row.UID
						if row.IsFolder {
							object = "folder:" + row.UID
						}
						key := &openfgav1.CheckRequestTupleKey{
							User:     query.SignedInUser.GetID().String(),
							Relation: "read",
							Object:   object,
						}

						checkRes, err := d.zClient.Check(ctx, &openfgav1.CheckRequest{
							StoreId:              d.zClient.MustStoreID(ctx),
							AuthorizationModelId: d.zClient.AuthorizationModelID,
							TupleKey:             key,
						})
						if err != nil {
							errChan <- err
							d.log.Warn("error checking access", "error", err)
						} else if checkRes.Allowed {
							allowedResults <- row
						}
					}
				}()
			}

			for _, r := range batchRows {
				rowsToCheck <- r
			}
			close(rowsToCheck)

			wg.Wait()
			close(allowedResults)
			for r := range allowedResults {
				res = append(res, r)
			}

			return nil
		})
		if err != nil {
			return nil, err
		}

		fetchedRows += batchSize

		// If the number of rows fetched in this batch is less than the batch size, break the loop
		if rowsFetchedInThisBatch < batchSize {
			break
		}
	}

	return res, nil
}

func (d *dashboardStore) findDashboardsZanzanaListFilter(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]dashboards.DashboardSearchProjection, error) {
	limit := query.Limit
	if limit < 1 {
		limit = 1000
	}

	page := query.Page
	if page < 1 {
		page = 1
	}

	dashFolderUIDs, err := d.listUserDashboardsFolders(ctx, query.SignedInUser.GetID().String())
	if err != nil {
		return nil, err
	}

	var res []dashboards.DashboardSearchProjection

	// Search for folders and dashboards
	query.DashboardUIDs = dashFolderUIDs
	sb := d.buildZanzanaSearchQuery(ctx, query)
	sql, params := sb.ToSQL(limit, page)
	err = d.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(sql, params...).Find(&res)
	})
	if err != nil {
		return nil, err
	}
	if len(res) > int(limit) {
		return res[:limit], nil
	}

	return res, nil
}

func (d *dashboardStore) buildZanzanaSearchQuery(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) *searchstore.Builder {
	filters := []any{}
	filters = append(filters, query.Filters...)

	var orgID int64
	if query.OrgId != 0 {
		orgID = query.OrgId
		filters = append(filters, searchstore.OrgFilter{OrgId: orgID})
	} else if query.SignedInUser.GetOrgID() != 0 {
		orgID = query.SignedInUser.GetOrgID()
		filters = append(filters, searchstore.OrgFilter{OrgId: orgID})
	}

	if len(query.Tags) > 0 {
		filters = append(filters, searchstore.TagsFilter{Tags: query.Tags})
	}

	if len(query.DashboardUIDs) > 0 {
		filters = append(filters, searchstore.DashboardFilter{UIDs: query.DashboardUIDs})
	} else if len(query.DashboardIds) > 0 {
		filters = append(filters, searchstore.DashboardIDFilter{IDs: query.DashboardIds})
	}

	if len(query.Title) > 0 {
		filters = append(filters, searchstore.TitleFilter{Dialect: d.store.GetDialect(), Title: query.Title})
	}

	if len(query.Type) > 0 {
		filters = append(filters, searchstore.TypeFilter{Dialect: d.store.GetDialect(), Type: query.Type})
	}
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
	// nolint:staticcheck
	if len(query.FolderIds) > 0 {
		filters = append(filters, searchstore.FolderFilter{IDs: query.FolderIds})
	}

	if len(query.FolderUIDs) > 0 {
		filters = append(filters, searchstore.FolderUIDFilter{
			Dialect:              d.store.GetDialect(),
			OrgID:                orgID,
			UIDs:                 query.FolderUIDs,
			NestedFoldersEnabled: d.features.IsEnabled(ctx, featuremgmt.FlagNestedFolders),
		})
	}

	sb := &searchstore.Builder{Dialect: d.store.GetDialect(), Filters: filters, Features: d.features}
	return sb
}

func (d *dashboardStore) listUserDashboardsFolders(ctx context.Context, userID string) ([]string, error) {
	// List dashboards and folders
	foldersRes, err := d.zClient.ListObjects(ctx, &openfgav1.ListObjectsRequest{
		StoreId:              d.zClient.MustStoreID(ctx),
		AuthorizationModelId: d.zClient.AuthorizationModelID,
		User:                 userID,
		// TODO: fix `read` relation and use it (returns only directly assigned folders without inheritance now)
		Relation: "dashboard_read",
		Type:     "folder",
	})
	if err != nil {
		return nil, err
	}

	dashRes, err := d.zClient.ListObjects(ctx, &openfgav1.ListObjectsRequest{
		StoreId:              d.zClient.MustStoreID(ctx),
		AuthorizationModelId: d.zClient.AuthorizationModelID,
		User:                 userID,
		Relation:             "read",
		Type:                 "dashboard",
	})
	if err != nil {
		return nil, err
	}

	folderUIDs := make([]string, 0, len(foldersRes.GetObjects()))
	for _, f := range foldersRes.GetObjects() {
		folderUIDs = append(folderUIDs, strings.TrimLeft(f, "folder:"))
	}
	dashboardUIDs := make([]string, 0, len(dashRes.GetObjects()))
	for _, d := range dashRes.GetObjects() {
		dashboardUIDs = append(dashboardUIDs, strings.TrimLeft(d, "dashboard:"))
	}

	return append(folderUIDs, dashboardUIDs...), nil
}
