package legacy

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	claims "github.com/grafana/authlib/types"
	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	foldersV1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	tracer = otel.Tracer("github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy")
)

type dashboardRow struct {
	// The numeric version for this dashboard
	RV int64

	// Dashboard resource
	Dash *dashboardV1.Dashboard

	// The folder UID (needed for access control checks)
	FolderUID string

	// The token we can use that will start a new connection that includes
	// this same dashboard
	token *continueToken

	// Legacy dashboard id and version. keyValid is false when they could not be read.
	internalID int64
	version    int64
	keyValid   bool
}

type dashboardSqlAccess struct {
	sql          legacysql.LegacyDatabaseProvider
	namespacer   request.NamespaceMapper
	provisioning provisioning.StubProvisioningService

	accessControl accesscontrol.AccessControl
	log           log.Logger
}

func ProvideMigrator(
	sql legacysql.LegacyDatabaseProvider,
	provisioning provisioning.StubProvisioningService,
	accessControl accesscontrol.AccessControl,
) Migrator {
	return NewMigratorAccess(sql, provisioning, accessControl)
}

func NewMigratorAccess(
	sql legacysql.LegacyDatabaseProvider,
	provisioning provisioning.StubProvisioningService,
	accessControl accesscontrol.AccessControl,
) *dashboardSqlAccess {
	return &dashboardSqlAccess{
		sql:           sql,
		namespacer:    claims.OrgNamespaceFormatter,
		provisioning:  provisioning,
		accessControl: accessControl,
		log:           log.New("legacy.migrator.accessor"),
	}
}

func NewDashboardSQLAccess(sql legacysql.LegacyDatabaseProvider,
	namespacer request.NamespaceMapper,
	provisioning provisioning.ProvisioningService,
	accessControl accesscontrol.AccessControl,
) *dashboardSqlAccess {
	return &dashboardSqlAccess{
		sql:           sql,
		namespacer:    namespacer,
		provisioning:  provisioning,
		accessControl: accessControl,
		log:           log.New("legacy.dashboard.accessor"),
	}
}

func (a *dashboardSqlAccess) executeQuery(ctx context.Context, helper *legacysql.LegacyDatabaseHelper, query string, args ...any) (*sql.Rows, error) {
	var tx *sql.Tx
	// After this function runs, the `tx` variable will only be set if
	// this function was called in the context of a transaction set up by a
	// caller upstream. In that case, we reuse the transaction.
	_ = helper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		coreTx, err := sess.Tx()
		if err != nil {
			return nil
		}

		tx = coreTx.Tx
		return nil
	})

	if tx != nil {
		return tx.QueryContext(ctx, query, args...)
	}

	return helper.DB.GetSqlxSession().Query(ctx, query, args...)
}

func (a *dashboardSqlAccess) getRows(ctx context.Context, helper *legacysql.LegacyDatabaseHelper, query *DashboardQuery) (*rowsWrapper, error) {
	ctx, span := tracer.Start(ctx, "legacy.dashboardSqlAccess.getRows")
	defer span.End()

	req := newQueryReq(helper, query)

	tmpl := sqlQueryDashboards
	if query.UseHistoryTable() && query.GetTrash {
		return nil, fmt.Errorf("trash not included in history table")
	}

	rawQuery, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", tmpl.Name(), err)
	}
	q := rawQuery
	// if false {
	// 	 pretty := sqltemplate.RemoveEmptyLines(rawQuery)
	//	 fmt.Printf("DASHBOARD QUERY: %s [%+v] // %+v\n", pretty, req.GetArgs(), query)
	// }

	rows, err := a.executeQuery(ctx, helper, q, req.GetArgs()...)
	if err != nil {
		if rows != nil {
			_ = rows.Close()
		}
		rows = nil
	}
	return &rowsWrapper{
		rows:    rows,
		a:       a,
		history: query.GetHistory,
	}, err
}

// Page bounds for the dashboard and folder migration reads. Each page is read fully and its rows
// closed before anything is sent, so no legacy SELECT stays open while unified storage writes and
// statement_timeout bounds one page rather than the whole org.
const (
	migrationPageMaxRows  = 500
	migrationPageMaxBytes = 32 * 1024 * 1024
)

// MigrateDashboards handles the dashboard migration logic
func (a *dashboardSqlAccess) MigrateDashboards(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	if !opts.WithHistory {
		return fmt.Errorf("dashboard migration requires history")
	}
	sql, err := a.sql(ctx)
	if err != nil {
		return err
	}

	opts.Progress(-1, "migrating dashboards...")
	scanned, rejected, err := a.migrateLegacyPages(ctx, sql, opts, stream, newDashboardPager(orgId))
	if err != nil {
		return err
	}

	for _, row := range rejected {
		id := row.Dash.Labels[utils.LabelKeyDeprecatedInternalID]
		a.log.Warn("rejected dashboard",
			"namespace", opts.Namespace,
			"dashboard", row.Dash.Name,
			"uid", row.Dash.UID,
			"id", id,
			"version", row.Dash.Generation,
		)
		opts.Progress(-2, fmt.Sprintf("rejected: id:%s, uid:%s", id, row.Dash.Name))
	}

	opts.Progress(-2, fmt.Sprintf("finished dashboards... (%d)", scanned))
	return nil
}

// MigrateFolders handles the folder migration logic
func (a *dashboardSqlAccess) MigrateFolders(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	sql, err := a.sql(ctx)
	if err != nil {
		return err
	}

	opts.Progress(-1, "migrating folders...")
	scanned, _, err := a.migrateLegacyPages(ctx, sql, opts, stream, newFolderPager(orgId))
	if err != nil {
		return err
	}

	opts.Progress(-2, fmt.Sprintf("finished folders... (%d)", scanned))
	return nil
}

// legacyPager reads one kind of legacy row page by page.
type legacyPager struct {
	query *DashboardQuery
	build migrationRequestBuilder
	// beforePage runs before each page query, in the same transaction.
	beforePage func(ctx context.Context, a *dashboardSqlAccess, helper *legacysql.LegacyDatabaseHelper) error
	// advance moves query past a page read with the given row limit and reports whether rows may remain.
	advance func(page *migrationPage, limit int) (bool, error)
	// window is how many dashboards bound a dashboard page
	window int
}

func newFolderPager(orgID int64) *legacyPager {
	// Folders are listed by descending id, so each page continues below the last id
	query := &DashboardQuery{OrgID: orgID, GetFolders: true}
	return &legacyPager{
		query: query,
		build: folderBulkRequest,
		advance: func(page *migrationPage, limit int) (bool, error) {
			if !page.full(limit) {
				return false, nil
			}
			if page.lastID <= 0 || (query.LastID > 0 && page.lastID >= query.LastID) {
				return false, fmt.Errorf("folder migration paging did not advance past id %d", query.LastID)
			}
			query.LastID = page.lastID
			return true, nil
		},
	}
}

// newDashboardPager pages dashboard rows by (dashboard id, version). Each page is also bounded by the
// id of the n-th next dashboard: the sort key is not an index, so without the bound some databases sort
// the rest of the org for every page. n follows how many dashboards the previous page covered.
func newDashboardPager(orgID int64) *legacyPager {
	query := &DashboardQuery{
		OrgID:         orgID,
		GetHistory:    true,
		AllowFallback: true, // allow fallback to dashboard table during migration
	}
	p := &legacyPager{query: query, build: dashboardBulkRequest, window: migrationPageMaxRows}
	p.beforePage = func(ctx context.Context, a *dashboardSqlAccess, helper *legacysql.LegacyDatabaseHelper) error {
		bound, err := a.dashboardPageBound(ctx, helper, query, p.window)
		query.UpToID = bound
		return err
	}
	p.advance = func(page *migrationPage, limit int) (bool, error) {
		if !page.full(limit) {
			if query.UpToID == 0 {
				return false, nil
			}
			// Every row up to the bound was read, so the window was smaller than a page
			query.AfterID, query.AfterVersion = query.UpToID, math.MaxInt32
			p.window = min(p.window*2, migrationPageMaxRows)
			return true, nil
		}
		if page.lastID < query.AfterID || (page.lastID == query.AfterID && page.lastVersion <= query.AfterVersion) {
			return false, fmt.Errorf("dashboard migration paging did not advance past id %d version %d", query.AfterID, query.AfterVersion)
		}
		query.AfterID, query.AfterVersion = page.lastID, page.lastVersion
		// Also after an unbounded page: an org with fewer dashboards than the window would
		// otherwise never get a bound
		p.window = min(page.dashboards+1, migrationPageMaxRows)
		return true, nil
	}
	return p
}

// dashboardPageBound returns the id of the n-th dashboard at or after the keyset, or 0 when fewer remain.
func (a *dashboardSqlAccess) dashboardPageBound(ctx context.Context, helper *legacysql.LegacyDatabaseHelper, query *DashboardQuery, n int) (int64, error) {
	req := newDashboardIDsQueryReq(helper, query, n)
	rawQuery, err := sqltemplate.Execute(sqlQueryDashboardIDs, req)
	if err != nil {
		return 0, fmt.Errorf("execute template %q: %w", sqlQueryDashboardIDs.Name(), err)
	}
	rows, err := a.executeQuery(ctx, helper, rawQuery, req.GetArgs()...)
	if err != nil {
		return 0, err
	}
	defer func() {
		_ = rows.Close()
	}()

	var id int64
	count := 0
	for rows.Next() {
		if err := rows.Scan(&id); err != nil {
			return 0, err
		}
		count++
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	if count < n {
		return 0, nil
	}
	return id, nil
}

// migrateLegacyPages sends the pager's rows to stream.
func (a *dashboardSqlAccess) migrateLegacyPages(
	ctx context.Context,
	helper *legacysql.LegacyDatabaseHelper,
	opts migrations.MigrateOptions,
	stream resourcepb.BulkStore_BulkProcessClient,
	p *legacyPager,
) (scanned int, rejected []dashboardRow, err error) {
	send := migrationSender(stream, opts)

	if helper.DialectForDriver().DialectName() == "sqlite" {
		// SQLite has no statement timeout. One read keeps its SHARED lock for the whole migration,
		// so a bulk write cannot spill into an EXCLUSIVE lock that would lock out a later page.
		page, err := a.queryMigrationPage(ctx, helper, p.query, opts.Namespace, nil, p.build, 0, send)
		if err != nil {
			return 0, nil, err
		}
		return page.scanned, page.rejected, nil
	}

	limit := migrationPageMaxRows
	for {
		p.query.MaxRows = limit
		page, err := a.readMigrationPage(ctx, helper, opts, func(ctx context.Context) (*migrationPage, error) {
			if p.beforePage != nil {
				if err := p.beforePage(ctx, a, helper); err != nil {
					return nil, err
				}
			}
			return a.queryMigrationPage(ctx, helper, p.query, opts.Namespace, rejected, p.build, migrationPageMaxBytes, nil)
		})
		if err != nil {
			return scanned, rejected, err
		}
		rejected = page.rejected
		scanned += page.scanned

		for _, item := range page.items {
			if stop, err := send(item); stop || err != nil {
				return scanned, rejected, err
			}
		}

		more, err := p.advance(page, limit)
		if err != nil || !more {
			return scanned, rejected, err
		}
		limit = nextPageLimit(page, limit)
	}
}

// migrationSender sends one item and reports whether to stop, which it does when the stream ended.
func migrationSender(stream resourcepb.BulkStore_BulkProcessClient, opts migrations.MigrateOptions) func(migrationItem) (bool, error) {
	sent := 0
	return func(item migrationItem) (bool, error) {
		sent++
		opts.Progress(sent, fmt.Sprintf("[v:%2d] %s (size:%d / %d)", item.generation, item.req.Key.Name, len(item.req.Value), sent))
		if err := stream.Send(item.req); err != nil {
			if errors.Is(err, io.EOF) {
				opts.Progress(sent, fmt.Sprintf("stream EOF/cancelled. index=%d", sent))
				return true, nil
			}
			return true, err
		}
		return false, nil
	}
}

// nextPageLimit shrinks the row limit to the rows that fit after a page cut by the byte limit, so the
// next query does not fetch rows that are discarded on close, and grows it back otherwise.
func nextPageLimit(page *migrationPage, limit int) int {
	if page.cutByBytes {
		return max(page.scanned, 1)
	}
	return min(limit*2, migrationPageMaxRows)
}

// migrationRequestBuilder turns the current legacy row into the request written to unified storage.
type migrationRequestBuilder func(rows *rowsWrapper, namespace string) (*resourcepb.BulkRequest, error)

func dashboardBulkRequest(rows *rowsWrapper, namespace string) (*resourcepb.BulkRequest, error) {
	dash := rows.row.Dash
	if dash.APIVersion == "" {
		dash.APIVersion = fmt.Sprintf("%s/v0alpha1", dashboardV1.GROUP)
	}
	dash.SetNamespace(namespace)
	dash.SetResourceVersion("") // it will be filled in by the backend

	body, err := json.Marshal(dash)
	if err != nil {
		return nil, fmt.Errorf("error reading json from: %s // %w", dash.Name, err)
	}

	return &resourcepb.BulkRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: namespace,
			Group:     dashboardV1.GROUP,
			Resource:  dashboardV1.DASHBOARD_RESOURCE,
			Name:      rows.Name(),
		},
		Value:  body,
		Folder: rows.row.FolderUID,
		Action: bulkAction(dash.Generation),
	}, nil
}

func folderBulkRequest(rows *rowsWrapper, namespace string) (*resourcepb.BulkRequest, error) {
	dash := rows.row.Dash
	dash.APIVersion = foldersV1beta1.APIVERSION
	dash.Kind = "Folder"
	dash.SetNamespace(namespace)
	dash.SetResourceVersion("") // it will be filled in by the backend

	spec := map[string]any{
		"title": dash.Spec.Object["title"],
	}
	description := dash.Spec.Object["description"]
	if description != nil {
		spec["description"] = description
	}
	dash.Spec.Object = spec

	body, err := json.Marshal(dash)
	if err != nil {
		return nil, err
	}

	return &resourcepb.BulkRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: namespace,
			Group:     "folder.grafana.app",
			Resource:  "folders",
			Name:      rows.Name(),
		},
		Value:  body,
		Folder: rows.row.FolderUID,
		Action: bulkAction(dash.Generation),
	}, nil
}

func bulkAction(generation int64) resourcepb.BulkRequest_Action {
	switch {
	case generation > 1:
		return resourcepb.BulkRequest_MODIFIED
	case generation < 0:
		return resourcepb.BulkRequest_DELETED
	default:
		return resourcepb.BulkRequest_ADDED
	}
}

type migrationItem struct {
	req        *resourcepb.BulkRequest
	generation int64
}

type migrationPage struct {
	items      []migrationItem
	rejected   []dashboardRow
	scanned    int // rows read, including rejected ones
	dashboards int // distinct dashboard ids read

	// Keyset of the last scanned row; the next page starts after it
	lastID      int64
	lastVersion int64

	// The page stopped at the byte limit before its row limit
	cutByBytes bool
}

// full reports whether the page stopped at a limit, so more rows may follow.
func (p *migrationPage) full(limit int) bool {
	return p.cutByBytes || p.scanned >= limit
}

// readMigrationPage runs fetch, in a transaction carrying the statement timeout override when one is set.
func (a *dashboardSqlAccess) readMigrationPage(ctx context.Context, helper *legacysql.LegacyDatabaseHelper, opts migrations.MigrateOptions, fetch func(context.Context) (*migrationPage, error)) (*migrationPage, error) {
	if opts.StatementTimeout <= 0 {
		return fetch(ctx)
	}
	// executeQuery reuses the transaction from ctx, so the override covers only this page's queries
	var page *migrationPage
	err := helper.DB.InTransaction(ctx, func(ctx context.Context) error {
		if err := helper.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			_, err := sess.Exec(migrations.StatementTimeoutSQL(opts.StatementTimeout))
			return err
		}); err != nil {
			return err
		}
		var err error
		page, err = fetch(ctx)
		return err
	})
	return page, err
}

// queryMigrationPage reads query's rows into a page, or hands each one to emit as it is read when emit is set.
func (a *dashboardSqlAccess) queryMigrationPage(ctx context.Context, helper *legacysql.LegacyDatabaseHelper, query *DashboardQuery, namespace string, rejected []dashboardRow, build migrationRequestBuilder, maxBytes int, emit func(migrationItem) (bool, error)) (*migrationPage, error) {
	rows, err := a.getRows(ctx, helper, query)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err != nil {
		return nil, err
	}
	rows.rejected = rejected
	return collectMigrationPage(rows, namespace, maxBytes, build, emit)
}

// collectMigrationPage reads rows until they end or maxBytes (when positive) is reached.
func collectMigrationPage(rows *rowsWrapper, namespace string, maxBytes int, build migrationRequestBuilder, emit func(migrationItem) (bool, error)) (*migrationPage, error) {
	page := &migrationPage{}
	size := 0
	var lastDashboard int64
	for rows.Next() {
		if rows.lastID != lastDashboard {
			page.dashboards++
			lastDashboard = rows.lastID
		}
		req, err := build(rows, namespace)
		if err != nil {
			return nil, err
		}
		item := migrationItem{req: req, generation: rows.row.Dash.Generation}
		if emit != nil {
			stop, err := emit(item)
			if err != nil {
				return nil, err
			}
			if stop {
				break
			}
		} else {
			page.items = append(page.items, item)
		}

		size += len(req.Value)
		if maxBytes > 0 && size >= maxBytes {
			page.cutByBytes = true
			break
		}
	}
	if err := rows.Error(); err != nil {
		return nil, err
	}

	page.scanned = rows.count
	page.rejected = rows.rejected
	page.lastID, page.lastVersion = rows.lastID, rows.lastVersion
	return page, nil
}

// MigrateLibraryPanels handles the library panel migration logic
func (a *dashboardSqlAccess) MigrateLibraryPanels(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
	return migrateLibraryPanelPages(ctx, orgId, opts, stream, a.GetLibraryPanels, 1000)
}

func migrateLibraryPanelPages(
	ctx context.Context,
	orgID int64,
	opts migrations.MigrateOptions,
	stream resourcepb.BulkStore_BulkProcessClient,
	getPanels func(context.Context, LibraryPanelQuery) (*dashboardV0.LibraryPanelList, error),
	pageSize int64,
) error {
	opts.Progress(-1, "migrating library panels...")
	var lastID int64
	count := 0
	for {
		panels, err := getPanels(ctx, LibraryPanelQuery{
			OrgID:  orgID,
			Limit:  pageSize,
			LastID: lastID,
		})
		if err != nil {
			return err
		}
		for _, panel := range panels.Items {
			panel.Namespace = opts.Namespace
			meta, err := utils.MetaAccessor(&panel)
			if err != nil {
				return err
			}
			body, err := json.Marshal(panel)
			if err != nil {
				return err
			}

			req := &resourcepb.BulkRequest{
				Key: &resourcepb.ResourceKey{
					Namespace: opts.Namespace,
					Group:     dashboardV1.GROUP,
					Resource:  dashboardV1.LIBRARY_PANEL_RESOURCE,
					Name:      panel.Name,
				},
				Value:  body,
				Folder: meta.GetFolder(),
				Action: resourcepb.BulkRequest_ADDED,
			}
			if panel.Generation > 1 {
				req.Action = resourcepb.BulkRequest_MODIFIED
			}

			count++
			opts.Progress(count, fmt.Sprintf("[v:%d] %s (%d)", panel.Generation, meta.GetName(), len(req.Value)))

			err = stream.Send(req)
			if err != nil {
				if errors.Is(err, io.EOF) {
					err = nil
				}
				return err
			}
		}
		if panels.Continue == "" {
			break
		}
		nextID, err := strconv.ParseInt(panels.Continue, 10, 64)
		if err != nil || nextID <= 0 || (lastID > 0 && nextID >= lastID) {
			return fmt.Errorf("invalid library panel continuation token %q", panels.Continue)
		}
		lastID = nextID
	}
	opts.Progress(-2, fmt.Sprintf("finished panels... (%d)", count))
	return nil
}

type rowsWrapper struct {
	a       *dashboardSqlAccess
	rows    *sql.Rows
	history bool
	count   int

	// Current
	row *dashboardRow
	err error

	// max 100 rejected?
	rejected []dashboardRow

	// Key of the last scanned row with a readable key, including rejected rows, so the next
	// page does not read and count the same rejections again
	lastID      int64
	lastVersion int64
}

func (r *rowsWrapper) Close() error {
	if r.rows == nil {
		return nil
	}
	return r.rows.Close()
}

func (r *rowsWrapper) Next() bool {
	if r.err != nil {
		return false
	}
	var err error

	// breaks after first readable value
	defer func() {
		r.err = errors.Join(r.err, r.rows.Err())
	}()
	for r.rows.Next() {
		r.count++

		r.row, err = r.a.scanRow(r.rows, r.history)
		if r.row != nil && r.row.keyValid {
			r.lastID, r.lastVersion = r.row.internalID, r.row.version
		}
		if err != nil {
			r.a.log.Error("error scanning dashboard", "error", err)
			if len(r.rejected) > 100 || r.row == nil {
				r.err = fmt.Errorf("too many rejected rows (%d) %w", len(r.rejected), err)
				return false
			}
			r.rejected = append(r.rejected, *r.row)
			continue
		}

		if r.row != nil {
			// returns the first visible dashboard
			return true
		}
	}
	return false
}

func (r *rowsWrapper) Error() error {
	return r.err
}

func (r *rowsWrapper) Name() string {
	return r.row.Dash.Name
}

func generateFallbackDashboard(data []byte, title, uid string) ([]byte, error) {
	generatedDashboard := map[string]interface{}{
		"editable": true,
		"id":       1,
		"panels": []map[string]interface{}{
			{
				"description": "The JSON is invalid. You can import it again after fixing it.",
				"gridPos":     map[string]interface{}{"h": 8, "w": 24, "x": 0, "y": 0},
				"id":          1,
				"options": map[string]interface{}{
					"code":    map[string]interface{}{"language": "plaintext", "showLineNumbers": false, "showMiniMap": false},
					"content": string(data),
					"mode":    "code",
				},
				"title": "Invalid dashboard",
				"type":  "text",
			},
		},
		"schemaVersion": 42,
		"title":         title,
		"uid":           uid,
		"version":       3,
	}
	return json.Marshal(generatedDashboard)
}

func (a *dashboardSqlAccess) parseDashboard(dash *dashboardV1.Dashboard, data []byte, id int64, title string) error {
	if err := dash.Spec.UnmarshalJSON(data); err != nil {
		a.log.Warn("error unmarshalling dashboard spec. Generating fallback dashboard data", "error", err, "uid", dash.UID, "id", id, "name", dash.Name)
		dash.Spec = *dashboardV0.NewDashboardSpec()

		dashboardData, err := generateFallbackDashboard(data, title, string(dash.UID))
		if err != nil {
			a.log.Warn("error generating fallback dashboard data", "error", err, "uid", dash.UID, "id", id, "name", dash.Name)
			return err
		}

		if err = dash.Spec.UnmarshalJSON(dashboardData); err != nil {
			a.log.Warn("error unmarshalling fallback dashboard data", "error", err, "uid", dash.UID, "id", id, "name", dash.Name)
			return err
		}
	}
	return nil
}

// scanRowKey reads the dashboard id and version of the current row without type conversion,
// for rows whose typed Scan failed. The positions follow the column order in scanRow.
func scanRowKey(rows *sql.Rows) (id int64, version int64, ok bool) {
	cols, err := rows.Columns()
	if err != nil || len(cols) <= 17 {
		return 0, 0, false
	}
	values := make([]any, len(cols))
	dest := make([]any, len(cols))
	for i := range values {
		dest[i] = &values[i]
	}
	if err := rows.Scan(dest...); err != nil {
		return 0, 0, false
	}
	id, idOK := asInt64(values[1])
	version, versionOK := asInt64(values[17])
	return id, version, idOK && versionOK
}

// asInt64 accepts any integer type, not only the int64 that database/sql drivers are expected to return.
func asInt64(v any) (int64, bool) {
	switch x := v.(type) {
	case int64:
		return x, true
	case int:
		return int64(x), true
	case int32:
		return int64(x), true
	case int16:
		return int64(x), true
	case int8:
		return int64(x), true
	case uint64:
		return int64(x), x <= math.MaxInt64
	case uint:
		return int64(x), uint64(x) <= math.MaxInt64
	case uint32:
		return int64(x), true
	case uint16:
		return int64(x), true
	case uint8:
		return int64(x), true
	case []byte:
		n, err := strconv.ParseInt(string(x), 10, 64)
		return n, err == nil
	case string:
		n, err := strconv.ParseInt(x, 10, 64)
		return n, err == nil
	}
	return 0, false
}

func (a *dashboardSqlAccess) scanRow(rows *sql.Rows, history bool) (*dashboardRow, error) {
	dash := &dashboardV1.Dashboard{
		TypeMeta:   dashboardV1.DashboardResourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{Annotations: make(map[string]string)},
	}
	row := &dashboardRow{Dash: dash}

	var dashboard_id int64
	var orgId int64
	var folder_uid sql.NullString
	var title string
	var updated legacysql.DBTime
	var updatedBy sql.NullString
	var updatedByID sql.NullInt64
	var deleted sql.NullTime

	var created legacysql.DBTime
	var createdBy sql.NullString
	var createdByID sql.NullInt64
	var message sql.NullString
	var apiVersion sql.NullString

	var plugin_id sql.NullString
	var origin_name sql.NullString
	var origin_path sql.NullString
	var origin_ts sql.NullInt64
	var origin_hash sql.NullString
	var data []byte // the dashboard JSON
	var version int64

	err := rows.Scan(&orgId, &dashboard_id, &dash.Name, &title, &folder_uid,
		&deleted, &plugin_id,
		&origin_name, &origin_path, &origin_hash, &origin_ts,
		&created, &createdBy, &createdByID,
		&updated, &updatedBy, &updatedByID,
		&version, &message, &data, &apiVersion,
	)
	row.internalID, row.version, row.keyValid = dashboard_id, version, err == nil
	if err != nil {
		row.internalID, row.version, row.keyValid = scanRowKey(rows)
	}

	switch apiVersion.String {
	case "":
		apiVersion.String = dashboardV0.VERSION // default value
	case "v1alpha1":
		apiVersion.String = dashboardV0.VERSION // downgrade to v0 (it may not have run migrations)
	}

	row.token = &continueToken{orgId: orgId, id: dashboard_id}
	// when listing from the history table, we want to use the version as the ID to continue from
	if history {
		row.token.id = version
	}
	if err == nil {
		row.RV = version
		dash.ResourceVersion = fmt.Sprintf("%d", row.RV)
		dash.Namespace = a.namespacer(orgId)
		dash.APIVersion = fmt.Sprintf("%s/%s", dashboardV1.GROUP, apiVersion.String)
		dash.UID = gapiutil.CalculateClusterWideUID(dash)
		dash.SetCreationTimestamp(metav1.NewTime(created.Time))
		meta, err := utils.MetaAccessor(dash)
		if err != nil {
			a.log.Debug("failed to get meta accessor for dashboard", "error", err, "uid", dash.UID, "name", dash.Name, "version", version)
			return nil, err
		}
		meta.SetUpdatedTimestamp(&updated.Time)
		meta.SetCreatedBy(getUserID(createdBy, createdByID))
		meta.SetUpdatedBy(getUserID(updatedBy, updatedByID))
		meta.SetDeprecatedInternalID(dashboard_id) //nolint:staticcheck
		meta.SetGeneration(version)

		if deleted.Valid {
			meta.SetDeletionTimestamp(new(metav1.NewTime(deleted.Time)))
			meta.SetGeneration(utils.DeletedGeneration)
		}

		if message.String != "" {
			if len(message.String) > 500 {
				message.String = message.String[0:490] + "..."
			}
			meta.SetMessage(message.String)
		}
		if folder_uid.String != "" {
			meta.SetFolder(folder_uid.String)
			row.FolderUID = folder_uid.String
		}

		if origin_name.String != "" {
			editable := a.provisioning.GetAllowUIUpdatesFromConfig(origin_name.String)
			prefix := a.provisioning.GetDashboardProvisionerResolvedPath(origin_name.String) + "/"
			meta.SetSourceProperties(utils.SourceProperties{
				Path:            strings.TrimPrefix(origin_path.String, prefix),
				Checksum:        origin_hash.String,
				TimestampMillis: origin_ts.Int64,
			})
			meta.SetManagerProperties(utils.ManagerProperties{
				Kind:        utils.ManagerKindClassicFP, // nolint:staticcheck
				Identity:    origin_name.String,
				AllowsEdits: editable,
			})
		} else if plugin_id.String != "" {
			meta.SetManagerProperties(utils.ManagerProperties{
				Kind:     utils.ManagerKindPlugin,
				Identity: plugin_id.String,
			})
		}

		if len(data) > 0 {
			if err := a.parseDashboard(dash, data, dashboard_id, title); err != nil {
				return row, err
			}
		}
		// Ignore any saved values for id/version/uid
		delete(dash.Spec.Object, "id")
		delete(dash.Spec.Object, "version")
		delete(dash.Spec.Object, "uid")
	}
	return row, err
}

func getUserID(v sql.NullString, id sql.NullInt64) string {
	if v.Valid && v.String != "" {
		return claims.NewTypeID(claims.TypeUser, v.String)
	}
	if id.Valid && id.Int64 == -1 {
		return claims.NewTypeID(claims.TypeProvisioning, "")
	}
	return ""
}

type panel struct {
	ID        int64
	UID       string
	FolderUID sql.NullString

	Created   time.Time
	CreatedBy sql.NullString

	Updated   time.Time
	UpdatedBy sql.NullString

	Version int64

	Name        string
	Type        string
	Description string
	Model       []byte
}

func (a *dashboardSqlAccess) GetLibraryPanels(ctx context.Context, query LibraryPanelQuery) (*dashboardV0.LibraryPanelList, error) {
	ctx, span := tracer.Start(ctx, "legacy.dashboardSqlAccess.GetLibraryPanels")
	defer span.End()

	limit := int(query.Limit)
	// Access control is evaluated after reading SQL rows, so stream all remaining
	// candidates until we find one more readable item than the requested page.
	query.Limit = 0
	if query.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	helper, err := a.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newLibraryQueryReq(helper, &query)
	rawQuery, err := sqltemplate.Execute(sqlQueryPanels, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryPanels.Name(), err)
	}

	rows, err := a.executeQuery(ctx, helper, rawQuery, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()
	if err != nil {
		return nil, err
	}

	res, err := collectLibraryPanelPage(rows, limit, func(item dashboardV0.LibraryPanel) (bool, error) {
		return a.accessControl.Evaluate(ctx, user, accesscontrol.EvalPermission(
			libraryelements.ActionLibraryPanelsRead,
			libraryelements.ScopeLibraryPanelsProvider.GetResourceScopeUID(item.Name),
		))
	})
	if err != nil {
		return res, err
	}
	if query.UID == "" {
		rv, err := helper.GetResourceVersion(ctx, "library_element", "updated")
		if err == nil {
			res.ResourceVersion = strconv.FormatInt(rv*1000, 10) // convert to microseconds
		}
	}
	return res, nil
}

func collectLibraryPanelPage(
	rows *sql.Rows,
	limit int,
	evaluate func(dashboardV0.LibraryPanel) (bool, error),
) (*dashboardV0.LibraryPanelList, error) {
	res := &dashboardV0.LibraryPanelList{}
	var lastReturnedID int64
	for rows.Next() {
		p := panel{}
		err := rows.Scan(&p.ID, &p.UID, &p.FolderUID,
			&p.Created, &p.CreatedBy,
			&p.Updated, &p.UpdatedBy,
			&p.Name, &p.Type, &p.Description, &p.Model, &p.Version,
		)
		if err != nil {
			return res, err
		}

		item, err := parseLibraryPanelRow(p)
		if err != nil {
			return res, err
		}

		ok, err := evaluate(item)
		if err != nil || !ok {
			continue
		}

		if limit > 0 && len(res.Items) >= limit {
			res.Continue = strconv.FormatInt(lastReturnedID, 10)
			break
		}
		res.Items = append(res.Items, item)
		lastReturnedID = p.ID
	}
	return res, rows.Err()
}

func parseLibraryPanelRow(p panel) (dashboardV0.LibraryPanel, error) {
	item := dashboardV0.LibraryPanel{
		TypeMeta: metav1.TypeMeta{
			APIVersion: dashboardV0.APIVERSION,
			Kind:       "LibraryPanel",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name:              p.UID,
			CreationTimestamp: metav1.NewTime(p.Created),
			ResourceVersion:   strconv.FormatInt(p.Updated.UnixMicro(), 10),
		},
		Spec: dashboardV0.LibraryPanelSpec{},
	}

	status := &dashboardV0.LibraryPanelStatus{
		Missing: v0alpha1.Unstructured{},
	}
	err := json.Unmarshal(p.Model, &item.Spec)
	if err != nil {
		return item, err
	}
	err = json.Unmarshal(p.Model, &status.Missing.Object)
	if err != nil {
		return item, err
	}

	// the panel title used in dashboards and title of the library panel can differ
	// in the old model blob, the panel title is specified as "title", and the library panel title is
	// in "libraryPanel.name", or as the column in the db.
	item.Spec.PanelTitle = item.Spec.Title
	item.Spec.Title = p.Name

	if item.Spec.Title != p.Name {
		status.Warnings = append(status.Warnings, fmt.Sprintf("title mismatch (expected: %s)", p.Name))
	}
	if item.Spec.Description != p.Description {
		status.Warnings = append(status.Warnings, fmt.Sprintf("description mismatch (expected: %s)", p.Description))
	}
	if item.Spec.Type != p.Type {
		status.Warnings = append(status.Warnings, fmt.Sprintf("type mismatch (expected: %s)", p.Type))
	}
	item.Status = status

	// Remove the properties we are already showing
	for _, k := range []string{"type", "pluginVersion", "title", "description", "options", "fieldConfig", "datasource", "targets", "links", "transparent", "libraryPanel", "id", "gridPos"} {
		delete(status.Missing.Object, k)
	}

	meta, err := utils.MetaAccessor(&item)
	if err != nil {
		return item, err
	}
	if p.FolderUID.Valid {
		meta.SetFolder(p.FolderUID.String)
	}
	meta.SetCreatedBy(getUserID(p.CreatedBy, sql.NullInt64{}))
	meta.SetGeneration(p.Version)
	meta.SetDeprecatedInternalID(p.ID) //nolint:staticcheck

	// Only set updated metadata if it is different
	if p.UpdatedBy.Valid && p.Updated.Sub(p.Created) > time.Second {
		meta.SetUpdatedBy(getUserID(p.UpdatedBy, sql.NullInt64{}))
		meta.SetUpdatedTimestamp(&p.Updated)
	}

	return item, nil
}
