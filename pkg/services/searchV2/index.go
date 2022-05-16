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

	"github.com/blugelabs/bluge"
)

type dashboardLoader interface {
	// LoadDashboards returns slice of dashboards. If dashboardUID is empty – then
	// implementation must return all dashboards in instance to build an entire
	// dashboard index for an organization. If dashboardUID is not empty – then only
	// return dashboard with specified UID or empty slice if not found (this is required
	// to apply partial update).
	LoadDashboards(ctx context.Context, orgID int64, dashboardUID string) ([]dashboard, error)
}

type eventStore interface {
	GetLastEvent(ctx context.Context) (*store.EntityEvent, error)
	GetAllEventsAfter(ctx context.Context, id int64) ([]*store.EntityEvent, error)
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

type dashboardIndex struct {
	mu           sync.RWMutex
	loader       dashboardLoader
	perOrgReader map[int64]*bluge.Reader // orgId -> bluge reader
	perOrgWriter map[int64]*bluge.Writer // orgId -> bluge writer
	eventStore   eventStore
	logger       log.Logger
	buildSignals chan int64
}

func newDashboardIndex(dashLoader dashboardLoader, evStore eventStore) *dashboardIndex {
	return &dashboardIndex{
		loader:       dashLoader,
		eventStore:   evStore,
		perOrgReader: map[int64]*bluge.Reader{},
		perOrgWriter: map[int64]*bluge.Writer{},
		logger:       log.New("dashboardIndex"),
		buildSignals: make(chan int64),
	}
}

func (i *dashboardIndex) run(ctx context.Context) error {
	fullReIndexTicker := time.NewTicker(5 * time.Minute)
	defer fullReIndexTicker.Stop()

	partialUpdateTicker := time.NewTicker(5 * time.Second)
	defer partialUpdateTicker.Stop()

	var lastEventID int64
	lastEvent, err := i.eventStore.GetLastEvent(ctx)
	if err != nil {
		return err
	}
	if lastEvent != nil {
		lastEventID = lastEvent.Id
	}

	// Build on start for orgID 1 but keep lazy for others.
	started := time.Now()
	numDashboards, err := i.buildOrgIndex(ctx, 1)
	if err != nil {
		return fmt.Errorf("can't build dashboard search index for org ID 1: %w", err)
	}
	i.logger.Info("Indexing for main org finished", "mainOrgIndexElapsed", time.Since(started), "numDashboards", numDashboards)

	for {
		select {
		case <-partialUpdateTicker.C:
			lastEventID = i.applyIndexUpdates(ctx, lastEventID)
		case orgID := <-i.buildSignals:
			i.mu.RLock()
			_, ok := i.perOrgWriter[orgID]
			if ok {
				// Index for org already exists, do nothing.
				i.mu.RUnlock()
				continue
			}
			i.mu.RUnlock()
			_, _ = i.buildOrgIndex(ctx, orgID)
		case <-fullReIndexTicker.C:
			started := time.Now()
			i.reIndexFromScratch(ctx)
			i.logger.Info("Full re-indexing finished", "fullReIndexElapsed", time.Since(started))
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func (i *dashboardIndex) buildOrgIndex(ctx context.Context, orgID int64) (int, error) {
	started := time.Now()
	ctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()

	i.logger.Info("Start building org index", "orgId", orgID)
	dashboards, err := i.loader.LoadDashboards(ctx, orgID, "")
	if err != nil {
		return 0, fmt.Errorf("error loading dashboards: %w", err)
	}
	orgSearchIndexLoadTime := time.Since(started)
	i.logger.Info("Finish loading org dashboards", "elapsed", orgSearchIndexLoadTime, "orgId", orgID)

	reader, writer, err := initIndex(dashboards, i.logger)
	if err != nil {
		return 0, fmt.Errorf("error initializing index: %w", err)
	}
	orgSearchIndexTotalTime := time.Since(started)
	orgSearchIndexBuildTime := orgSearchIndexTotalTime - orgSearchIndexLoadTime

	i.logger.Info("Re-indexed dashboards for organization",
		"orgId", orgID,
		"orgSearchIndexLoadTime", orgSearchIndexLoadTime,
		"orgSearchIndexBuildTime", orgSearchIndexBuildTime,
		"orgSearchIndexTotalTime", orgSearchIndexTotalTime)

	i.mu.Lock()
	i.perOrgReader[orgID] = reader
	i.perOrgWriter[orgID] = writer
	i.mu.Unlock()
	return len(dashboards), nil
}

func (i *dashboardIndex) getOrgReader(orgID int64) (*bluge.Reader, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	r, ok := i.perOrgReader[orgID]
	return r, ok
}

func (i *dashboardIndex) getOrgWriter(orgID int64) (*bluge.Writer, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	w, ok := i.perOrgWriter[orgID]
	return w, ok
}

func (i *dashboardIndex) reIndexFromScratch(ctx context.Context) {
	i.mu.RLock()
	orgIDs := make([]int64, 0, len(i.perOrgWriter))
	for orgID := range i.perOrgWriter {
		orgIDs = append(orgIDs, orgID)
	}
	i.mu.RUnlock()

	for _, orgID := range orgIDs {
		_, err := i.buildOrgIndex(ctx, orgID)
		if err != nil {
			i.logger.Error("Error re-indexing dashboards for organization", "orgId", orgID, "error", err)
			continue
		}
	}
}

func (i *dashboardIndex) applyIndexUpdates(ctx context.Context, lastEventID int64) int64 {
	events, err := i.eventStore.GetAllEventsAfter(context.Background(), lastEventID)
	if err != nil {
		i.logger.Error("can't load events", "error", err)
		return lastEventID
	}
	if len(events) == 0 {
		return lastEventID
	}
	started := time.Now()
	for _, e := range events {
		i.logger.Debug("processing event", "event", e)
		err := i.applyEventOnIndex(ctx, e)
		if err != nil {
			i.logger.Error("can't apply event", "error", err)
			return lastEventID
		}
		lastEventID = e.Id
	}
	i.logger.Info("Index updates applied", "indexEventsAppliedElapsed", time.Since(started), "numEvents", len(events))
	return lastEventID
}

func (i *dashboardIndex) applyEventOnIndex(ctx context.Context, e *store.EntityEvent) error {
	if !strings.HasPrefix(e.EntityId, "database/") {
		i.logger.Warn("unknown storage", "entityId", e.EntityId)
		return nil
	}
	parts := strings.Split(strings.TrimPrefix(e.EntityId, "database/"), "/")
	if len(parts) != 3 {
		i.logger.Error("can't parse entityId", "entityId", e.EntityId)
		return nil
	}
	orgIDStr := parts[0]
	kind := parts[1]
	dashboardUID := parts[2]
	if kind != "dashboard" {
		i.logger.Error("unknown kind in entityId", "entityId", e.EntityId)
		return nil
	}
	orgID, err := strconv.Atoi(orgIDStr)
	if err != nil {
		i.logger.Error("can't extract org ID", "entityId", e.EntityId)
		return nil
	}
	return i.applyDashboardEvent(ctx, int64(orgID), dashboardUID, e.EventType)
}

func (i *dashboardIndex) applyDashboardEvent(ctx context.Context, orgID int64, dashboardUID string, _ store.EntityEventType) error {
	i.mu.Lock()
	_, ok := i.perOrgWriter[orgID]
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

	writer, ok := i.perOrgWriter[orgID]
	if !ok {
		// Skip event for org not yet fully indexed.
		return nil
	}
	reader, ok := i.perOrgReader[orgID]
	if !ok {
		// Skip event for org not yet fully indexed.
		return nil
	}

	var newReader *bluge.Reader

	// In the future we can rely on operation types to reduce work here.
	if len(dbDashboards) == 0 {
		newReader, err = i.removeDashboard(writer, reader, dashboardUID)
	} else {
		newReader, err = i.updateDashboard(writer, reader, dbDashboards[0])
	}
	if err != nil {
		return err
	}
	i.perOrgReader[orgID] = newReader
	return nil
}

func (i *dashboardIndex) removeDashboard(writer *bluge.Writer, reader *bluge.Reader, dashboardUID string) (*bluge.Reader, error) {
	// Find all panel docs to remove with dashboard.
	panelIDs, err := getDashboardPanelIDs(reader, dashboardUID)
	if err != nil {
		return nil, err
	}

	batch := bluge.NewBatch()
	batch.Delete(bluge.NewDocument(dashboardUID).ID())
	for _, panelID := range panelIDs {
		batch.Delete(bluge.NewDocument(panelID).ID())
	}

	err = writer.Batch(batch)
	if err != nil {
		return nil, err
	}

	return writer.Reader()
}

func stringInSlice(str string, slice []string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}

func (i *dashboardIndex) updateDashboard(writer *bluge.Writer, reader *bluge.Reader, dash dashboard) (*bluge.Reader, error) {
	batch := bluge.NewBatch()

	var doc *bluge.Document
	if dash.isFolder {
		doc = getFolderDashboardDoc(dash)
	} else {
		var folderUID string
		if dash.folderID == 0 {
			folderUID = "general"
		} else {
			var err error
			folderUID, err = getDashboardFolderUID(reader, dash.folderID)
			if err != nil {
				return nil, err
			}
		}

		location := folderUID
		doc = getNonFolderDashboardDoc(dash, location)

		var actualPanelIDs []string

		location += "/" + dash.uid
		panelDocs := getDashboardPanelDocs(dash, location)
		for _, panelDoc := range panelDocs {
			actualPanelIDs = append(actualPanelIDs, string(panelDoc.ID().Term()))
			batch.Update(panelDoc.ID(), panelDoc)
		}

		indexedPanelIDs, err := getDashboardPanelIDs(reader, dash.uid)
		if err != nil {
			return nil, err
		}

		for _, panelID := range indexedPanelIDs {
			if !stringInSlice(panelID, actualPanelIDs) {
				batch.Delete(bluge.NewDocument(panelID).ID())
			}
		}
	}

	batch.Update(doc.ID(), doc)

	err := writer.Batch(batch)
	if err != nil {
		return nil, err
	}

	return writer.Reader()
}

type sqlDashboardLoader struct {
	sql    *sqlstore.SQLStore
	logger log.Logger
}

func newSQLDashboardLoader(sql *sqlstore.SQLStore) *sqlDashboardLoader {
	return &sqlDashboardLoader{sql: sql, logger: log.New("sqlDashboardLoader")}
}

func (l sqlDashboardLoader) LoadDashboards(ctx context.Context, orgID int64, dashboardUID string) ([]dashboard, error) {
	var dashboards []dashboard

	limit := 1

	if dashboardUID == "" {
		limit = 200
		dashboards = make([]dashboard, 0, limit+1)

		// Add the root folder ID (does not exist in SQL).
		dashboards = append(dashboards, dashboard{
			id:       0,
			uid:      "",
			isFolder: true,
			folderID: 0,
			slug:     "",
			created:  time.Now(),
			updated:  time.Now(),
			info: &extract.DashboardInfo{
				ID:    0,
				Title: "General",
			},
		})
	}

	// key will allow name or uid
	lookup, err := loadDatasourceLookup(ctx, orgID, l.sql)
	if err != nil {
		return dashboards, err
	}

	var lastID int64

	for {
		rows := make([]*dashboardQueryResult, 0, limit)

		err = l.sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			sess.Table("dashboard").
				Where("org_id = ?", orgID)

			if lastID > 0 {
				sess.Where("id > ?", lastID)
			}

			if dashboardUID != "" {
				sess.Where("uid = ?", dashboardUID)
			}

			sess.Cols("id", "uid", "is_folder", "folder_id", "data", "slug", "created", "updated")

			sess.Limit(limit)

			return sess.Find(&rows)
		})

		if err != nil {
			return nil, err
		}

		for _, row := range rows {
			info, err := extract.ReadDashboard(bytes.NewReader(row.Data), lookup)
			if err != nil {
				l.logger.Warn("Error indexing dashboard data", "error", err, "dashboardId", row.Id, "dashboardSlug", row.Slug)
				// But append info anyway for now, since we possibly extracted useful information.
			}
			dashboards = append(dashboards, dashboard{
				id:       row.Id,
				uid:      row.Uid,
				isFolder: row.IsFolder,
				folderID: row.FolderID,
				slug:     row.Slug,
				created:  row.Created,
				updated:  row.Updated,
				info:     info,
			})
			lastID = row.Id
		}

		if len(rows) < limit || dashboardUID != "" {
			break
		}
	}

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
