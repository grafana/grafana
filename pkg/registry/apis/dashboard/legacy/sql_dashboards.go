package legacy

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/utils/ptr"

	claims "github.com/grafana/authlib/types"
	dashboardOG "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	playlistv0 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacysearcher"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	tracer = otel.Tracer("github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy")
)

type MigrateOptions struct {
	Namespace   string
	Resources   []schema.GroupResource
	WithHistory bool // only applies to dashboards
	OnlyCount   bool // just count the values
	Progress    func(count int, msg string)
}

type BlobStoreInfo struct {
	Count int64
	Size  int64
}

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
}

type dashboardSqlAccess struct {
	sql          legacysql.LegacyDatabaseProvider
	namespacer   request.NamespaceMapper
	provisioning provisioning.StubProvisioningService

	// Use for writing (not reading)
	dashStore              dashboards.Store
	dashboardSearchClient  legacysearcher.DashboardSearchClient
	dashboardPermissionSvc accesscontrol.DashboardPermissionsService

	accessControl   accesscontrol.AccessControl
	libraryPanelSvc librarypanels.Service // only used for save dashboard

	// Typically one... the server wrapper
	subscribers []chan *resource.WrittenEvent
	mutex       sync.Mutex
	log         log.Logger
}

// ProvideMigratorDashboardAccessor creates a DashboardAccess specifically for migration purposes.
// This provider is used by Wire DI and only includes the minimal dependencies needed for migrations.
func ProvideMigratorDashboardAccessor(
	sql legacysql.LegacyDatabaseProvider,
	provisioning provisioning.StubProvisioningService,
	accessControl accesscontrol.AccessControl,
) MigrationDashboardAccessor {
	return &dashboardSqlAccess{
		sql:                    sql,
		namespacer:             claims.OrgNamespaceFormatter,
		dashStore:              nil, // not needed for migration
		provisioning:           provisioning,
		dashboardPermissionSvc: nil, // not needed for migration
		libraryPanelSvc:        nil, // not needed for migration
		accessControl:          accessControl,
	}
}

func NewDashboardSQLAccess(sql legacysql.LegacyDatabaseProvider,
	namespacer request.NamespaceMapper,
	dashStore dashboards.Store,
	provisioning provisioning.ProvisioningService,
	libraryPanelSvc librarypanels.Service,
	sorter sort.Service,
	dashboardPermissionSvc accesscontrol.DashboardPermissionsService,
	accessControl accesscontrol.AccessControl,
	features featuremgmt.FeatureToggles,
) *dashboardSqlAccess {
	dashboardSearchClient := legacysearcher.NewDashboardSearchClient(dashStore, sorter)
	return &dashboardSqlAccess{
		sql:                    sql,
		namespacer:             namespacer,
		dashStore:              dashStore,
		provisioning:           provisioning,
		dashboardSearchClient:  *dashboardSearchClient,
		dashboardPermissionSvc: dashboardPermissionSvc,
		libraryPanelSvc:        libraryPanelSvc,
		accessControl:          accessControl,
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

	// Use transaction from unified storage if available in the context.
	// This allows us to run migrations in a transaction which is specifically required for SQLite.
	if tx == nil {
		tx = resource.TransactionFromContext(ctx)
	}

	if tx != nil {
		return tx.QueryContext(ctx, query, args...)
	}

	return helper.DB.GetSqlxSession().Query(ctx, query, args...)
}

func (a *dashboardSqlAccess) getRows(ctx context.Context, helper *legacysql.LegacyDatabaseHelper, query *DashboardQuery) (*rowsWrapper, error) {
	ctx, span := tracer.Start(ctx, "legacy.dashboardSqlAccess.getRows")
	defer span.End()

	if len(query.Labels) > 0 {
		return nil, fmt.Errorf("labels not yet supported")
		// if query.Requirements.Folder != nil {
		// 	args = append(args, *query.Requirements.Folder)
		// 	sqlcmd = fmt.Sprintf("%s AND dashboard.folder_uid=?$%d", sqlcmd, len(args))
		// }
	}

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

// CountResources counts resources without migrating them
func (a *dashboardSqlAccess) CountResources(ctx context.Context, opts MigrateOptions) (*resourcepb.BulkResponse, error) {
	sql, err := a.sql(ctx)
	if err != nil {
		return nil, err
	}
	ns, err := claims.ParseNamespace(opts.Namespace)
	if err != nil {
		return nil, err
	}
	orgId := ns.OrgID
	rsp := &resourcepb.BulkResponse{}
	err = sql.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		for _, res := range opts.Resources {
			switch fmt.Sprintf("%s/%s", res.Group, res.Resource) {
			case "folder.grafana.app/folders":
				summary := &resourcepb.BulkResponse_Summary{}
				summary.Group = folders.GROUP
				summary.Group = folders.RESOURCE
				_, err = sess.SQL("SELECT COUNT(*) FROM "+sql.Table("dashboard")+
					" WHERE is_folder=TRUE AND org_id=?", orgId).Get(&summary.Count)
				rsp.Summary = append(rsp.Summary, summary)

			case "dashboard.grafana.app/librarypanels":
				summary := &resourcepb.BulkResponse_Summary{}
				summary.Group = dashboardV1.GROUP
				summary.Resource = dashboardV1.LIBRARY_PANEL_RESOURCE
				_, err = sess.SQL("SELECT COUNT(*) FROM "+sql.Table("library_element")+
					" WHERE org_id=?", orgId).Get(&summary.Count)
				rsp.Summary = append(rsp.Summary, summary)

			case "dashboard.grafana.app/dashboards":
				summary := &resourcepb.BulkResponse_Summary{}
				summary.Group = dashboardV1.GROUP
				summary.Resource = dashboardV1.DASHBOARD_RESOURCE
				rsp.Summary = append(rsp.Summary, summary)

				_, err = sess.SQL("SELECT COUNT(*) FROM "+sql.Table("dashboard")+
					" WHERE is_folder=FALSE AND org_id=?", orgId).Get(&summary.Count)
				if err != nil {
					return err
				}

				// Also count history
				_, err = sess.SQL(`SELECT COUNT(*)
						FROM `+sql.Table("dashboard_version")+` as dv
						JOIN `+sql.Table("dashboard")+`         as dd
						ON dd.id = dv.dashboard_id
						WHERE org_id=?`, orgId).Get(&summary.History)
			}
			if err != nil {
				return err
			}
		}
		return nil
	})
	return rsp, nil
}

// MigrateDashboards handles the dashboard migration logic
func (a *dashboardSqlAccess) MigrateDashboards(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) (*BlobStoreInfo, error) {
	query := &DashboardQuery{
		OrgID:         orgId,
		Limit:         100000000,
		GetHistory:    opts.WithHistory, // include history
		AllowFallback: true,             // allow fallback to dashboard table during migration
		Order:         "ASC",            // oldest first
	}

	blobs := &BlobStoreInfo{}
	sql, err := a.sql(ctx)
	if err != nil {
		return blobs, err
	}

	opts.Progress(-1, "migrating dashboards...")
	rows, err := a.getRows(ctx, sql, query)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err != nil {
		return blobs, err
	}

	// Now send each dashboard
	for i := 1; rows.Next(); i++ {
		dash := rows.row.Dash
		if dash.APIVersion == "" {
			dash.APIVersion = fmt.Sprintf("%s/v0alpha1", dashboardV1.GROUP)
		}
		dash.SetNamespace(opts.Namespace)
		dash.SetResourceVersion("") // it will be filled in by the backend

		body, err := json.Marshal(dash)
		if err != nil {
			err = fmt.Errorf("error reading json from: %s // %w", rows.row.Dash.Name, err)
			return blobs, err
		}

		req := &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     dashboardV1.GROUP,
				Resource:  dashboardV1.DASHBOARD_RESOURCE,
				Name:      rows.Name(),
			},
			Value:  body,
			Folder: rows.row.FolderUID,
			Action: resourcepb.BulkRequest_ADDED,
		}
		if dash.Generation > 1 {
			req.Action = resourcepb.BulkRequest_MODIFIED
		} else if dash.Generation < 0 {
			req.Action = resourcepb.BulkRequest_DELETED
		}

		opts.Progress(i, fmt.Sprintf("[v:%2d] %s (size:%d / %d|%d)", dash.Generation, dash.Name, len(req.Value), i, rows.count))

		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				opts.Progress(i, fmt.Sprintf("stream EOF/cancelled. index=%d", i))
				err = nil
			}
			return blobs, err
		}
	}

	if len(rows.rejected) > 0 {
		for _, row := range rows.rejected {
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
	}

	if rows.Error() != nil {
		return blobs, rows.Error()
	}

	opts.Progress(-2, fmt.Sprintf("finished dashboards... (%d)", rows.count))
	return blobs, err
}

// MigrateFolders handles the folder migration logic
func (a *dashboardSqlAccess) MigrateFolders(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) (*BlobStoreInfo, error) {
	query := &DashboardQuery{
		OrgID:      orgId,
		Limit:      100000000,
		GetFolders: true,
		Order:      "ASC",
	}

	sql, err := a.sql(ctx)
	if err != nil {
		return nil, err
	}

	opts.Progress(-1, "migrating folders...")
	rows, err := a.getRows(ctx, sql, query)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err != nil {
		return nil, err
	}

	// Now send each dashboard
	for i := 1; rows.Next(); i++ {
		dash := rows.row.Dash
		dash.APIVersion = "folder.grafana.app/v1beta1"
		dash.Kind = "Folder"
		dash.SetNamespace(opts.Namespace)
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

		req := &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     "folder.grafana.app",
				Resource:  "folders",
				Name:      rows.Name(),
			},
			Value:  body,
			Folder: rows.row.FolderUID,
			Action: resourcepb.BulkRequest_ADDED,
		}
		if dash.Generation > 1 {
			req.Action = resourcepb.BulkRequest_MODIFIED
		} else if dash.Generation < 0 {
			req.Action = resourcepb.BulkRequest_DELETED
		}

		opts.Progress(i, fmt.Sprintf("[v:%d] %s (%d)", dash.Generation, dash.Name, len(req.Value)))

		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				err = nil
			}
			return nil, err
		}
	}

	if rows.Error() != nil {
		return nil, rows.Error()
	}

	opts.Progress(-2, fmt.Sprintf("finished folders... (%d)", rows.count))
	return nil, err
}

// MigrateLibraryPanels handles the library panel migration logic
func (a *dashboardSqlAccess) MigrateLibraryPanels(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) (*BlobStoreInfo, error) {
	opts.Progress(-1, "migrating library panels...")
	panels, err := a.GetLibraryPanels(ctx, LibraryPanelQuery{
		OrgID: orgId,
		Limit: 1000000,
	})
	if err != nil {
		return nil, err
	}
	for i, panel := range panels.Items {
		meta, err := utils.MetaAccessor(&panel)
		if err != nil {
			return nil, err
		}
		body, err := json.Marshal(panel)
		if err != nil {
			return nil, err
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

		opts.Progress(i, fmt.Sprintf("[v:%d] %s (%d)", i, meta.GetName(), len(req.Value)))

		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				err = nil
			}
			return nil, err
		}
	}
	opts.Progress(-2, fmt.Sprintf("finished panels... (%d)", len(panels.Items)))
	return nil, nil
}

// MigratePlaylists handles the playlist migration logic
func (a *dashboardSqlAccess) MigratePlaylists(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) (*BlobStoreInfo, error) {
	opts.Progress(-1, "migrating playlists...")
	rows, err := a.ListPlaylists(ctx, orgId)
	if rows != nil {
		defer func() {
			_ = rows.Close()
		}()
	}
	if err != nil {
		return nil, err
	}

	// Group playlist items by playlist ID
	type playlistData struct {
		id        int64
		uid       string
		name      string
		interval  string
		items     []playlistv0.PlaylistItem
		createdAt int64
		updatedAt int64
	}

	playlists := make(map[int64]*playlistData)
	var currentID int64
	var orgID int64
	var uid, name, interval string
	var createdAt, updatedAt int64
	var itemType, itemValue sql.NullString

	count := 0
	for rows.Next() {
		err = rows.Scan(&currentID, &orgID, &uid, &name, &interval, &createdAt, &updatedAt, &itemType, &itemValue)
		if err != nil {
			return nil, err
		}

		// Get or create playlist entry
		pl, exists := playlists[currentID]
		if !exists {
			pl = &playlistData{
				id:        currentID,
				uid:       uid,
				name:      name,
				interval:  interval,
				items:     []playlistv0.PlaylistItem{},
				createdAt: createdAt,
				updatedAt: updatedAt,
			}
			playlists[currentID] = pl
		}

		// Add item if it exists (LEFT JOIN can return NULL for playlists without items)
		if itemType.Valid && itemValue.Valid {
			pl.items = append(pl.items, playlistv0.PlaylistItem{
				Type:  playlistv0.PlaylistItemType(itemType.String),
				Value: itemValue.String,
			})
		}
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	// Convert to K8s objects and send to stream
	for _, pl := range playlists {
		playlist := &playlistv0.Playlist{
			TypeMeta: metav1.TypeMeta{
				APIVersion: playlistv0.GroupVersion.String(),
				Kind:       "Playlist",
			},
			ObjectMeta: metav1.ObjectMeta{
				Name:              pl.uid,
				Namespace:         opts.Namespace,
				CreationTimestamp: metav1.NewTime(time.UnixMilli(pl.createdAt)),
			},
			Spec: playlistv0.PlaylistSpec{
				Title:    pl.name,
				Interval: pl.interval,
				Items:    pl.items,
			},
		}

		// Set updated timestamp if different from created
		if pl.updatedAt != pl.createdAt {
			meta, err := utils.MetaAccessor(playlist)
			if err != nil {
				return nil, err
			}
			updatedTime := time.UnixMilli(pl.updatedAt)
			meta.SetUpdatedTimestamp(&updatedTime)
		}

		body, err := json.Marshal(playlist)
		if err != nil {
			return nil, err
		}

		req := &resourcepb.BulkRequest{
			Key: &resourcepb.ResourceKey{
				Namespace: opts.Namespace,
				Group:     "playlist.grafana.app",
				Resource:  "playlists",
				Name:      pl.uid,
			},
			Value:  body,
			Action: resourcepb.BulkRequest_ADDED,
		}

		opts.Progress(count, fmt.Sprintf("%s (%d)", pl.name, len(req.Value)))
		count++

		err = stream.Send(req)
		if err != nil {
			if errors.Is(err, io.EOF) {
				err = nil
			}
			return nil, err
		}
	}
	opts.Progress(-2, fmt.Sprintf("finished playlists... (%d)", len(playlists)))
	return nil, nil
}

var _ resource.ListIterator = (*rowsWrapper)(nil)

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
}

func (a *dashboardSqlAccess) GetResourceStats(ctx context.Context, nsr resource.NamespacedResource, minCount int) ([]resource.ResourceStats, error) {
	return nil, fmt.Errorf("not implemented")
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
	for r.rows.Next() {
		r.count++

		r.row, err = r.a.scanRow(r.rows, r.history)
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

// ContinueToken implements resource.ListIterator.
func (r *rowsWrapper) ContinueToken() string {
	return r.row.token.String()
}

// Error implements resource.ListIterator.
func (r *rowsWrapper) Error() error {
	return r.err
}

// Name implements resource.ListIterator.
func (r *rowsWrapper) Name() string {
	return r.row.Dash.Name
}

// Namespace implements resource.ListIterator.
func (r *rowsWrapper) Namespace() string {
	return r.row.Dash.Namespace
}

// ResourceVersion implements resource.ListIterator.
func (r *rowsWrapper) ResourceVersion() int64 {
	return r.row.RV
}

func (r *rowsWrapper) Folder() string {
	return r.row.FolderUID
}

// Value implements resource.ListIterator.
func (r *rowsWrapper) Value() []byte {
	b, err := json.Marshal(r.row.Dash)
	r.err = err
	return b
}

// batchingIterator wraps rowsWrapper to fetch data in batches
type batchingIterator struct {
	wrapper   *rowsWrapper
	a         *dashboardSqlAccess
	ctx       context.Context
	helper    *legacysql.LegacyDatabaseHelper
	query     *DashboardQuery
	batchSize int
	done      bool
	err       error
}

var _ resource.ListIterator = (*batchingIterator)(nil)

func (b *batchingIterator) Error() error {
	if b.err != nil {
		return b.err
	}
	return b.wrapper.Error()
}

func (b *batchingIterator) ContinueToken() string {
	return b.wrapper.ContinueToken()
}

func (b *batchingIterator) ResourceVersion() int64 {
	return b.wrapper.ResourceVersion()
}

func (b *batchingIterator) Namespace() string {
	return b.wrapper.Namespace()
}

func (b *batchingIterator) Name() string {
	return b.wrapper.Name()
}

func (b *batchingIterator) Folder() string {
	return b.wrapper.Folder()
}

func (b *batchingIterator) Value() []byte {
	return b.wrapper.Value()
}

func (b *batchingIterator) Close() error {
	return b.wrapper.Close()
}

func newBatchingIterator(ctx context.Context, a *dashboardSqlAccess, helper *legacysql.LegacyDatabaseHelper, query *DashboardQuery) (*batchingIterator, error) {
	iter := &batchingIterator{
		a:         a,
		ctx:       ctx,
		helper:    helper,
		query:     query,
		batchSize: query.MaxRows,
	}

	// Loads the first batch
	if err := iter.nextBatch(query.LastID); err != nil {
		return nil, err
	}
	return iter, nil
}

func (b *batchingIterator) nextBatch(lastID int64) error {
	b.query.LastID = lastID
	wrapper, err := b.a.getRows(b.ctx, b.helper, b.query)
	if err != nil {
		return err
	}
	b.wrapper = wrapper
	return nil
}

func (b *batchingIterator) Next() bool {
	if b.done {
		return false
	}

	// Try to get next row from current batch
	if b.wrapper.Next() {
		return true
	}

	// Check for errors in current wrapper
	if b.Error() != nil {
		return false
	}

	// No more rows in current batch - close it
	if err := b.wrapper.Close(); err != nil {
		// Should not happen, but handle it
		b.err = err
		b.done = true
		return false
	}

	// Current batch exhausted - check if we got a full batch (might be more data)
	if b.wrapper.count < b.batchSize {
		// Got fewer rows than batch size, so we're done
		b.done = true
		return false
	}

	// Fetch next batch with LastID from last row
	if err := b.nextBatch(b.wrapper.row.token.id); err != nil {
		b.err = err
		b.done = true
		return false
	}

	// Try to get first row from new batch
	if b.wrapper.Next() {
		return true
	}

	// New batch is empty, we're done
	b.done = true
	return false
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
			meta.SetDeletionTimestamp(ptr.To(metav1.NewTime(deleted.Time)))
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

// DeleteDashboard implements DashboardAccess.
func (a *dashboardSqlAccess) DeleteDashboard(ctx context.Context, orgId int64, uid string) (*dashboardV1.Dashboard, bool, error) {
	ctx, span := tracer.Start(ctx, "legacy.dashboardSqlAccess.DeleteDashboard")
	defer span.End()

	dash, _, err := a.GetDashboard(ctx, orgId, uid, 0)
	if err != nil {
		return nil, false, err
	}

	err = a.dashStore.DeleteDashboard(ctx, &dashboards.DeleteDashboardCommand{
		OrgID: orgId,
		UID:   uid,
	})
	if err != nil {
		return nil, false, err
	}
	return dash, true, nil
}

func (a *dashboardSqlAccess) buildSaveDashboardCommand(ctx context.Context, orgId int64, dash *dashboardV1.Dashboard) (*dashboards.SaveDashboardCommand, bool, error) {
	ctx, span := tracer.Start(ctx, "legacy.dashboardSqlAccess.buildSaveDashboardCommand")
	defer span.End()

	created := false
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return nil, created, fmt.Errorf("no user found in context")
	}

	if dash.Name != "" {
		dash.Spec.Set("uid", dash.Name)

		// Get the previous version to set the internal ID
		old, _ := a.dashStore.GetDashboard(ctx, &dashboards.GetDashboardQuery{
			OrgID: orgId,
			UID:   dash.Name,
		})
		if old != nil {
			dash.Spec.Set("id", old.ID)
			dash.Spec.Set("version", float64(old.Version))
		} else {
			dash.Spec.Remove("id") // existing of "id" makes it an update
			created = true
		}
	} else {
		dash.Spec.Remove("id")
		dash.Spec.Remove("uid")
	}

	var userID int64
	if claims.IsIdentityType(user.GetIdentityType(), claims.TypeUser) || claims.IsIdentityType(user.GetIdentityType(), claims.TypeServiceAccount) {
		var err error
		userID, err = identity.UserIdentifier(user.GetSubject())
		if err != nil {
			return nil, created, err
		}
	}

	apiVersion := strings.TrimPrefix(dash.APIVersion, dashboardV1.GROUP+"/")
	meta, err := utils.MetaAccessor(dash)
	if err != nil {
		return nil, created, err
	}

	// v1 should be saved as schema version 41. v0 allows for older versions
	if strings.HasPrefix(apiVersion, "v1") {
		schemaVersion := schemaversion.GetSchemaVersion(dash.Spec.Object)
		if schemaVersion < int(schemaversion.LATEST_VERSION) {
			apiVersion = dashboardV0.VERSION
			a.log.Info("Downgrading v1alpha1 dashboard to v0alpha1 due to schema version mismatch", "dashboard", dash.Name, "schema_version", schemaVersion)
		}
	}

	return &dashboards.SaveDashboardCommand{
		OrgID:      orgId,
		Message:    meta.GetMessage(),
		PluginID:   dashboardOG.GetPluginIDFromMeta(meta),
		Dashboard:  simplejson.NewFromAny(dash.Spec.UnstructuredContent()),
		FolderUID:  meta.GetFolder(),
		Overwrite:  true, // already passed the revisionVersion checks!
		UserID:     userID,
		APIVersion: apiVersion,
	}, created, nil
}

func (a *dashboardSqlAccess) SaveDashboard(ctx context.Context, orgId int64, dash *dashboardV1.Dashboard, failOnExisting bool) (*dashboardV1.Dashboard, bool, error) {
	ctx, span := tracer.Start(ctx, "legacy.dashboardSqlAccess.SaveDashboard")
	defer span.End()

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return nil, false, fmt.Errorf("no user found in context")
	}

	cmd, created, err := a.buildSaveDashboardCommand(ctx, orgId, dash)
	if err != nil {
		return nil, created, err
	}
	if failOnExisting && !created {
		return nil, created, apierrors.NewConflict(dashboardV1.DashboardResourceInfo.GroupResource(), dash.Name, dashboards.ErrDashboardWithSameUIDExists)
	}

	out, err := a.dashStore.SaveDashboard(ctx, *cmd)
	if err != nil {
		return nil, false, err
	}
	if out != nil {
		created = (out.Created.Unix() == out.Updated.Unix()) // and now?
	}
	dash, _, err = a.GetDashboard(ctx, orgId, out.UID, 0)
	if err != nil {
		return nil, false, err
	} else if dash == nil {
		return nil, false, fmt.Errorf("unable to retrieve dashboard after save")
	}

	// TODO: for modes 3+, we need to migrate /api to /apis for library connections, and begin to
	// use search to return the connections, rather than the connections table.
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}
	err = a.libraryPanelSvc.ConnectLibraryPanelsForDashboard(ctx, requester, out)
	if err != nil {
		return nil, false, err
	}

	// stash the raw value in context (if requested)
	finalMeta, err := utils.MetaAccessor(dash)
	if err != nil {
		return nil, false, err
	}
	access := GetLegacyAccess(ctx)
	if access != nil {
		access.DashboardID = finalMeta.GetDeprecatedInternalID() // nolint:staticcheck
	}
	return dash, created, err
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
	query.Limit += 1 // for continue
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

	res := &dashboardV0.LibraryPanelList{}
	rows, err := a.executeQuery(ctx, helper, rawQuery, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()
	if err != nil {
		return nil, err
	}

	var lastID int64
	for rows.Next() {
		p := panel{}
		err = rows.Scan(&p.ID, &p.UID, &p.FolderUID,
			&p.Created, &p.CreatedBy,
			&p.Updated, &p.UpdatedBy,
			&p.Name, &p.Type, &p.Description, &p.Model, &p.Version,
		)
		if err != nil {
			return res, err
		}
		lastID = p.ID

		item, err := parseLibraryPanelRow(p)
		if err != nil {
			return res, err
		}

		ok, err := a.accessControl.Evaluate(ctx, user, accesscontrol.EvalPermission(
			libraryelements.ActionLibraryPanelsRead,
			libraryelements.ScopeLibraryPanelsProvider.GetResourceScopeUID(item.Name),
		))
		if err != nil || !ok {
			continue
		}

		res.Items = append(res.Items, item)
		if len(res.Items) > limit {
			res.Continue = strconv.FormatInt(lastID, 10)
			break
		}
	}
	if query.UID == "" {
		rv, err := helper.GetResourceVersion(ctx, "library_element", "updated")
		if err == nil {
			res.ResourceVersion = strconv.FormatInt(rv*1000, 10) // convert to microseconds
		}
	}
	return res, err
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
	for _, k := range []string{"type", "pluginVersion", "title", "description", "options", "fieldConfig", "datasource", "targets", "libraryPanel", "id", "gridPos"} {
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

func (b *dashboardSqlAccess) RebuildIndexes(ctx context.Context, req *resourcepb.RebuildIndexesRequest) (*resourcepb.RebuildIndexesResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

func (a *dashboardSqlAccess) ListPlaylists(ctx context.Context, orgID int64) (*sql.Rows, error) {
	ctx, span := tracer.Start(ctx, "legacy.dashboardSqlAccess.ListPlaylists")
	defer span.End()

	helper, err := a.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newPlaylistQueryReq(helper, &PlaylistQuery{
		OrgID: orgID,
	})

	rawQuery, err := sqltemplate.Execute(sqlQueryPlaylists, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryPlaylists.Name(), err)
	}

	rows, err := a.executeQuery(ctx, helper, rawQuery, req.GetArgs()...)
	if err != nil && rows != nil {
		_ = rows.Close()
		return nil, err
	}
	return rows, err
}
