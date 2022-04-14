package searchV2

import (
	"bytes"
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/store"
)

type dashboardLoader interface {
	LoadDashboards(ctx context.Context, orgID int64, dashboardUID string) ([]dashboard, error)
}

type DashboardIndex struct {
	mu         sync.RWMutex
	loader     dashboardLoader
	dashboards map[int64][]dashboard
	eventStore store.EntityEventsService
	logger     log.Logger
}

type dashboard struct {
	id       int64
	uid      string
	isFolder bool
	folderID int64
	slug     string
	created  time.Time
	updated  time.Time
	info     *extract.DashboardInfo
}

func NewDashboardIndex(eventStore store.EntityEventsService, loader dashboardLoader) *DashboardIndex {
	return &DashboardIndex{
		loader:     loader,
		dashboards: map[int64][]dashboard{},
		eventStore: eventStore,
		logger:     log.New("dashboardIndex"),
	}
}

func (i *DashboardIndex) run(ctx context.Context) error {
	fullUpdateTicker := time.NewTicker(5 * time.Minute)
	defer fullUpdateTicker.Stop()

	partialUpdateTicker := time.NewTicker(5 * time.Second)
	defer partialUpdateTicker.Stop()

	var lastEventID int64
	lastEvent, err := i.eventStore.GetLastEvent(context.Background())
	if err != nil {
		return err
	}
	if lastEvent != nil {
		lastEventID = lastEvent.Id
	}

	// Build on start for orgID 1 but keep lazy for others.
	_, err = i.getDashboards(ctx, 1)
	if err != nil {
		return fmt.Errorf("can't build dashboard search index for org ID 1: %w", err)
	}

	for {
		select {
		case <-partialUpdateTicker.C:
			lastEventID = i.loadIndexUpdates(context.Background(), lastEventID)
		case <-fullUpdateTicker.C:
			i.reIndexFromScratch()
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (i *DashboardIndex) reIndexFromScratch() {
	i.mu.Lock()
	defer i.mu.Unlock()
	for orgID := range i.dashboards {
		dashboards, err := i.getDashboards(context.Background(), orgID)
		if err != nil {
			i.logger.Error("can't re-index dashboards for org ID", "orgId", orgID, "error", err)
			continue
		}
		i.dashboards[orgID] = dashboards
	}
}

func (i *DashboardIndex) loadIndexUpdates(ctx context.Context, lastEventID int64) int64 {
	events, err := i.eventStore.GetAllEventsAfter(context.Background(), lastEventID)
	if err != nil {
		i.logger.Error("can't load events", "error", err)
		return lastEventID
	}
	if len(events) == 0 {
		i.logger.Info("no events since last update")
		return lastEventID
	}
	for _, e := range events {
		i.logger.Info("processing event", "event", e)
		err := i.applyEventOnIndex(ctx, e)
		if err != nil {
			i.logger.Error("can't apply event", "error", err)
			return lastEventID
		}
		lastEventID = e.Id
	}
	return lastEventID
}

func (i *DashboardIndex) applyEventOnIndex(ctx context.Context, e *store.EntityEvent) error {
	if !strings.HasPrefix(e.Grn, "database/") {
		i.logger.Info("unknown storage", "grn", e.Grn)
		return nil
	}
	parts := strings.Split(strings.TrimPrefix(e.Grn, "database/"), "/")
	if len(parts) != 3 {
		i.logger.Error("can't parse GRN", "grn", e.Grn)
		return nil
	}
	orgIDStr := parts[0]
	kind := parts[1]
	dashboardUID := parts[2]
	if kind != "dashboard" {
		i.logger.Error("unknown kind in GRN", "grn", e.Grn)
		return nil
	}
	orgID, err := strconv.Atoi(orgIDStr)
	if err != nil {
		i.logger.Error("can't extract org ID", "grn", e.Grn)
		return nil
	}
	return i.applyDashboardEvent(ctx, int64(orgID), dashboardUID, e.EventType)
}

func (i *DashboardIndex) applyDashboardEvent(ctx context.Context, orgID int64, dashboardUID string, _ store.EntityEventType) error {
	i.mu.Lock()
	_, ok := i.dashboards[orgID]
	if !ok {
		// Skip event for org not yet indexed.
		i.mu.Unlock()
		return nil
	}
	i.mu.Unlock()

	dbDashboards, err := i.loader.LoadDashboards(ctx, orgID, dashboardUID)
	if err != nil {
		return err
	}

	i.mu.Lock()
	defer i.mu.Unlock()

	dashboards, ok := i.dashboards[orgID]
	if !ok {
		// Skip event for org not yet fully indexed.
		return nil
	}

	if len(dbDashboards) == 0 {
		i.dashboards[orgID] = removeDashboard(dashboards, dashboardUID)
	} else {
		updated := false
		for i, d := range dashboards {
			if d.uid == dashboardUID {
				dashboards[i] = dbDashboards[0]
				updated = true
				break
			}
		}
		if !updated {
			dashboards = append(dashboards, dbDashboards...)
		}
		i.dashboards[orgID] = dashboards
	}
	return nil
}

func removeDashboard(dashboards []dashboard, dashboardUID string) []dashboard {
	k := 0
	for _, d := range dashboards {
		if d.uid != dashboardUID {
			dashboards[k] = d
			k++
		}
	}
	return dashboards[:k]
}

func (i *DashboardIndex) getDashboards(ctx context.Context, orgId int64) ([]dashboard, error) {
	var dashboards []dashboard

	i.mu.Lock()
	defer i.mu.Unlock()

	if cachedDashboards, ok := i.dashboards[orgId]; ok {
		dashboards = cachedDashboards
	} else {
		// Load and parse all dashboards for given orgId.
		var err error
		dashboards, err = i.loader.LoadDashboards(ctx, orgId, "")
		if err != nil {
			return nil, err
		}
		i.dashboards[orgId] = dashboards
	}
	return dashboards, nil
}

type sqlDashboardLoader struct {
	sql *sqlstore.SQLStore
}

func (l sqlDashboardLoader) LoadDashboards(ctx context.Context, orgID int64, dashboardUID string) ([]dashboard, error) {
	dashboards := make([]dashboard, 0, 200)

	if dashboardUID == "" {
		// Add the root folder ID (does not exist in SQL)
		dashboards = append(dashboards, dashboard{
			id:       0,
			isFolder: true,
			folderID: 0,
			slug:     "",
			created:  time.Now(),
			updated:  time.Now(),
			info: &extract.DashboardInfo{
				ID:    0,
				UID:   "",
				Title: "General",
			},
		})
	}

	// key will allow name or uid
	lookup, err := loadDatasourceLookup(ctx, orgID, l.sql)
	if err != nil {
		return dashboards, err
	}

	err = l.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rows := make([]*dashboardQueryResult, 0)

		sess.Table("dashboard").
			Where("org_id = ?", orgID)

		if dashboardUID != "" {
			sess.Where("uid = ?", dashboardUID)
		}

		sess.Cols("id", "uid", "is_folder", "folder_id", "data", "slug", "created", "updated")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		for _, row := range rows {
			dashboards = append(dashboards, dashboard{
				id:       row.Id,
				uid:      row.Uid,
				isFolder: row.IsFolder,
				folderID: row.FolderID,
				slug:     row.Slug,
				created:  row.Created,
				updated:  row.Updated,
				info:     extract.ReadDashboard(bytes.NewReader(row.Data), lookup),
			})
		}
		return nil
	})

	return dashboards, err
}

type dashboardQueryResult struct {
	Id       int64
	Uid      string
	IsFolder bool   `xorm:"is_folder"`
	FolderID int64  `xorm:"folder_id"`
	Slug     string `xorm:"slug"`
	Data     []byte
	Created  time.Time
	Updated  time.Time
}

type datasourceQueryResult struct {
	UID       string `xorm:"uid"`
	Type      string `xorm:"type"`
	Name      string `xorm:"name"`
	IsDefault bool   `xorm:"is_default"`
}

func loadDatasourceLookup(ctx context.Context, orgID int64, sql *sqlstore.SQLStore) (extract.DatasourceLookup, error) {
	byUID := make(map[string]*extract.DataSourceRef, 50)
	byName := make(map[string]*extract.DataSourceRef, 50)
	var defaultDS *extract.DataSourceRef

	err := sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rows := make([]*datasourceQueryResult, 0)
		sess.Table("data_source").
			Where("org_id = ?", orgID).
			Cols("uid", "name", "type", "is_default")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		for _, row := range rows {
			ds := &extract.DataSourceRef{
				UID:  row.UID,
				Type: row.Type,
			}
			byUID[row.UID] = ds
			byName[row.Name] = ds
			if row.IsDefault {
				defaultDS = ds
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	// Lookup by UID or name
	return func(ref *extract.DataSourceRef) *extract.DataSourceRef {
		if ref == nil {
			return defaultDS
		}
		key := ""
		if ref.UID != "" {
			ds, ok := byUID[ref.UID]
			if ok {
				return ds
			}
			key = ref.UID
		}
		if key == "" {
			return defaultDS
		}
		ds, ok := byUID[key]
		if ok {
			return ds
		}
		return byName[key]
	}, err
}
