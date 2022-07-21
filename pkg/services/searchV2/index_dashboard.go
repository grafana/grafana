package searchV2

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
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

// While we migrate away from internal IDs... this lets us lookup values in SQL
// NOTE: folderId is unique across all orgs
type folderUIDLookup = func(ctx context.Context, folderId int64) (string, error)

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

func getDashboardIndexFactory(dashLoader dashboardLoader, extender DocumentExtender, folderIDs folderUIDLookup) IndexFactory {
	return func(ctx context.Context, orgID int64, writer *bluge.Writer) (Index, error) {
		return createDashboardIndex(ctx, orgID, writer, dashLoader, extender, folderIDs)
	}
}

func createDashboardIndex(ctx context.Context, orgID int64, writer *bluge.Writer, dashLoader dashboardLoader, extender DocumentExtender, folderIDs folderUIDLookup) (*dashboardIndex, error) {
	i := &dashboardIndex{
		orgID:          orgID,
		loader:         dashLoader,
		logger:         log.New("dashboardIndex"),
		extender:       extender,
		folderIdLookup: folderIDs,
		writer:         writer,
	}
	if i.writer == nil {
		debugCtx, debugCtxCancel := context.WithCancel(ctx)
		if os.Getenv("GF_SEARCH_DEBUG") != "" {
			go debugResourceUsage(debugCtx, i.logger, 200*time.Millisecond)
		}

		started := time.Now()
		err := i.ReIndex(ctx)
		if err != nil {
			debugCtxCancel()
			return nil, err
		}
		i.logger.Info("Dashboard initial indexing finished", "orgIndexElapsed", time.Since(started), "orgId", orgID)
		debugCtxCancel()
		if os.Getenv("GF_SEARCH_DEBUG") != "" {
			// May help to estimate size of index when introducing changes. Though it's not a direct
			// match to a memory consumption, but at least make give some relative difference understanding.
			// Moreover, changes in indexing can cause additional memory consumption upon initial index build
			// which is not reflected here.
			reportSizeOfIndexDiskBackup(i, i.logger)
		}
	}
	return i, nil
}

type dashboardIndex struct {
	mu             sync.RWMutex
	orgID          int64
	writer         *bluge.Writer
	loader         dashboardLoader
	logger         log.Logger
	extender       DocumentExtender
	folderIdLookup folderUIDLookup
}

func (i *dashboardIndex) Reader() (*bluge.Reader, func(), error) {
	reader, err := i.writer.Reader()
	if err != nil {
		return nil, nil, err
	}
	return reader, func() { _ = reader.Close() }, nil
}

func (i *dashboardIndex) ReIndex(ctx context.Context) error {
	started := time.Now()
	ctx, cancel := context.WithTimeout(ctx, time.Minute)
	defer cancel()

	i.logger.Info("Start building org index", "orgId", i.orgID)
	dashboards, err := i.loader.LoadDashboards(ctx, i.orgID, "")
	if err != nil {
		return fmt.Errorf("error loading dashboards: %w", err)
	}
	orgSearchIndexLoadTime := time.Since(started)
	i.logger.Info("Finish loading org dashboards", "elapsed", orgSearchIndexLoadTime, "orgId", i.orgID)

	dashboardExtender := i.extender.GetDashboardExtender(i.orgID)

	writer, err := initDashboardWriter(dashboards, i.logger, dashboardExtender)
	if err != nil {
		return fmt.Errorf("error initializing dashboard writer: %w", err)
	}
	orgSearchIndexTotalTime := time.Since(started)
	orgSearchIndexBuildTime := orgSearchIndexTotalTime - orgSearchIndexLoadTime

	i.logger.Info("Re-indexed dashboards for organization",
		"orgId", i.orgID,
		"orgSearchIndexLoadTime", orgSearchIndexLoadTime,
		"orgSearchIndexBuildTime", orgSearchIndexBuildTime,
		"orgSearchIndexTotalTime", orgSearchIndexTotalTime,
		"orgSearchDashboardCount", len(dashboards))

	i.mu.Lock()
	if i.writer != nil {
		_ = i.writer.Close()
	}
	i.writer = writer
	i.mu.Unlock()

	if i.orgID == 1 {
		go func() {
			if reader, cancel, err := i.Reader(); err == nil {
				defer cancel()
				updateUsageStats(context.Background(), reader, i.logger)
			}
		}()
	}
	return nil
}

func (i *dashboardIndex) ApplyEvent(ctx context.Context, e store.ResourceEvent) error {
	i.logger.Debug("processing event", "event", e)
	return i.applyEvent(ctx, e)
}

func (i *dashboardIndex) BackupTo(ctx context.Context, dir string) error {
	return errors.New("not implemented")
}

func (i *dashboardIndex) applyEvent(ctx context.Context, resourceEvent store.ResourceEvent) error {
	if resourceEvent.Storage != "database" {
		i.logger.Warn("unknown storage", "storage", resourceEvent.Storage)
		return nil
	}

	// Both dashboard and folder share same DB table.
	dbDashboards, err := i.loader.LoadDashboards(ctx, i.orgID, resourceEvent.UID)
	if err != nil {
		return err
	}

	i.mu.Lock()
	defer i.mu.Unlock()

	// In the future we can rely on operation types to reduce work here.
	if len(dbDashboards) == 0 {
		switch resourceEvent.Kind {
		case store.EntityTypeDashboard:
			err = i.removeDashboard(ctx, resourceEvent.UID)
		case store.EntityTypeFolder:
			err = i.removeFolder(ctx, resourceEvent.UID)
		default:
			return nil
		}
	} else {
		err = i.updateDashboard(ctx, dbDashboards[0])
	}
	if err != nil {
		return err
	}
	return nil
}

func (i *dashboardIndex) removeDashboard(_ context.Context, dashboardUID string) error {
	reader, cancel, err := i.Reader()
	if err != nil {
		return err
	}
	defer cancel()

	dashboardLocation, ok, err := getDashboardLocation(reader, dashboardUID)
	if err != nil {
		return err
	}
	if !ok {
		// No dashboard, nothing to remove.
		return nil
	}

	// Find all panel docs to remove with dashboard.
	panelLocation := dashboardUID
	if dashboardLocation != "" {
		panelLocation = dashboardLocation + "/" + dashboardUID
	}

	panelIDs, err := getDocsIDsByLocationPrefix(reader, panelLocation)
	if err != nil {
		return err
	}

	writer := i.writer

	batch := bluge.NewBatch()
	batch.Delete(bluge.NewDocument(dashboardUID).ID())
	for _, panelID := range panelIDs {
		batch.Delete(bluge.NewDocument(panelID).ID())
	}

	return writer.Batch(batch)
}

func (i *dashboardIndex) removeFolder(_ context.Context, folderUID string) error {
	reader, cancel, err := i.Reader()
	if err != nil {
		return err
	}
	defer cancel()

	ids, err := getDocsIDsByLocationPrefix(reader, folderUID)
	if err != nil {
		return fmt.Errorf("error getting by location prefix: %w", err)
	}

	batch := bluge.NewBatch()
	batch.Delete(bluge.NewDocument(folderUID).ID())
	for _, id := range ids {
		batch.Delete(bluge.NewDocument(id).ID())
	}
	writer := i.writer
	return writer.Batch(batch)
}

func stringInSlice(str string, slice []string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}

func (i *dashboardIndex) updateDashboard(ctx context.Context, dash dashboard) error {
	extendDoc := i.extender.GetDashboardExtender(i.orgID, dash.uid)

	writer := i.writer

	var doc *bluge.Document
	if dash.isFolder {
		doc = getFolderDashboardDoc(dash)
		if err := extendDoc(dash.uid, doc); err != nil {
			return err
		}
		return writer.Update(doc.ID(), doc)
	}

	batch := bluge.NewBatch()

	var folderUID string
	if dash.folderID == 0 {
		folderUID = "general"
	} else {
		var err error
		folderUID, err = i.folderIdLookup(ctx, dash.folderID)
		if err != nil {
			return err
		}
	}

	location := folderUID
	doc = getNonFolderDashboardDoc(dash, location)
	if err := extendDoc(dash.uid, doc); err != nil {
		return err
	}

	var actualPanelIDs []string

	if location != "" {
		location += "/"
	}
	location += dash.uid
	panelDocs := getDashboardPanelDocs(dash, location)
	for _, panelDoc := range panelDocs {
		actualPanelIDs = append(actualPanelIDs, string(panelDoc.ID().Term()))
		batch.Update(panelDoc.ID(), panelDoc)
	}

	reader, cancel, err := i.Reader()
	if err != nil {
		return err
	}
	defer cancel()

	indexedPanelIDs, err := getDashboardPanelIDs(reader, location)
	if err != nil {
		return err
	}

	for _, panelID := range indexedPanelIDs {
		if !stringInSlice(panelID, actualPanelIDs) {
			batch.Delete(bluge.NewDocument(panelID).ID())
		}
	}

	batch.Update(doc.ID(), doc)

	return writer.Batch(batch)
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
	lookup, err := LoadDatasourceLookup(ctx, orgID, l.sql)
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

			sess.OrderBy("id ASC")
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

func newFolderIDLookup(sql *sqlstore.SQLStore) folderUIDLookup {
	return func(ctx context.Context, folderID int64) (string, error) {
		uid := ""
		err := sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			res, err := sess.Query("SELECT uid FROM dashboard WHERE id=?", folderID)
			if err != nil {
				return err
			}
			if len(res) > 0 {
				uid = string(res[0]["uid"])
			}
			return nil
		})
		return uid, err
	}
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

func createDatasourceLookup(rows []*datasourceQueryResult) extract.DatasourceLookup {
	byUID := make(map[string]*extract.DataSourceRef, 50)
	byName := make(map[string]*extract.DataSourceRef, 50)
	byType := make(map[string][]extract.DataSourceRef, 50)
	var defaultDS *extract.DataSourceRef

	for _, row := range rows {
		ref := &extract.DataSourceRef{
			UID:  row.UID,
			Type: row.Type,
		}
		byUID[row.UID] = ref
		byName[row.Name] = ref
		if row.IsDefault {
			defaultDS = ref
		}

		if _, ok := byType[row.Type]; !ok {
			byType[row.Type] = make([]extract.DataSourceRef, 5)
		}
		byType[row.Type] = append(byType[row.Type], *ref)
	}

	return &dsLookup{
		byName:    byName,
		byUID:     byUID,
		byType:    byType,
		defaultDS: defaultDS,
	}
}

type dsLookup struct {
	byName    map[string]*extract.DataSourceRef
	byUID     map[string]*extract.DataSourceRef
	byType    map[string][]extract.DataSourceRef
	defaultDS *extract.DataSourceRef
}

func (d *dsLookup) ByRef(ref *extract.DataSourceRef) *extract.DataSourceRef {
	if ref == nil {
		return d.defaultDS
	}
	key := ""
	if ref.UID != "" {
		ds, ok := d.byUID[ref.UID]
		if ok {
			return ds
		}
		key = ref.UID
	}
	if key == "" {
		return d.defaultDS
	}
	ds, ok := d.byUID[key]
	if ok {
		return ds
	}
	return d.byName[key]
}

func (d *dsLookup) ByType(dsType string) []extract.DataSourceRef {
	ds, ok := d.byType[dsType]
	if !ok {
		return make([]extract.DataSourceRef, 0)
	}

	return ds
}

func LoadDatasourceLookup(ctx context.Context, orgID int64, sql *sqlstore.SQLStore) (extract.DatasourceLookup, error) {
	rows := make([]*datasourceQueryResult, 0)

	if err := sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		sess.Table("data_source").
			Where("org_id = ?", orgID).
			Cols("uid", "name", "type", "is_default")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return createDatasourceLookup(rows), nil
}
