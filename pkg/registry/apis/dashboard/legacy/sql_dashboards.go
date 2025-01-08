package legacy

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	_ DashboardAccess = (*dashboardSqlAccess)(nil)
)

type dashboardRow struct {
	// The numeric version for this dashboard
	RV int64

	// Dashboard resource
	Dash *dashboard.Dashboard

	// The folder UID (needed for access control checks)
	FolderUID string

	// The token we can use that will start a new connection that includes
	// this same dashboard
	token *continueToken
}

type dashboardSqlAccess struct {
	sql          legacysql.LegacyDatabaseProvider
	namespacer   request.NamespaceMapper
	provisioning provisioning.ProvisioningService

	// Use for writing (not reading)
	dashStore  dashboards.Store
	softDelete bool

	// Typically one... the server wrapper
	subscribers []chan *resource.WrittenEvent
	mutex       sync.Mutex
}

func NewDashboardAccess(sql legacysql.LegacyDatabaseProvider,
	namespacer request.NamespaceMapper,
	dashStore dashboards.Store,
	provisioning provisioning.ProvisioningService,
	softDelete bool,
) DashboardAccess {
	return &dashboardSqlAccess{
		sql:          sql,
		namespacer:   namespacer,
		dashStore:    dashStore,
		provisioning: provisioning,
		softDelete:   softDelete,
	}
}

func (a *dashboardSqlAccess) getRows(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, query *DashboardQuery) (*rowsWrapper, error) {
	if len(query.Labels) > 0 {
		return nil, fmt.Errorf("labels not yet supported")
		// if query.Requirements.Folder != nil {
		// 	args = append(args, *query.Requirements.Folder)
		// 	sqlcmd = fmt.Sprintf("%s AND dashboard.folder_uid=?$%d", sqlcmd, len(args))
		// }
	}

	req := newQueryReq(sql, query)

	tmpl := sqlQueryDashboards
	if query.UseHistoryTable() && query.GetTrash {
		return nil, fmt.Errorf("trash not included in history table")
	}

	rawQuery, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", tmpl.Name(), err)
	}
	q := rawQuery
	// q = sqltemplate.RemoveEmptyLines(rawQuery)
	// fmt.Printf(">>%s [%+v]", q, req.GetArgs())

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	if err != nil {
		if rows != nil {
			_ = rows.Close()
		}
		rows = nil
	}
	return &rowsWrapper{
		rows: rows,
		a:    a,
		// This looks up rules from the permissions on a user
		canReadDashboard: func(scopes ...string) bool {
			return true // ???
		},
		// accesscontrol.Checker(user, dashboards.ActionDashboardsRead),
	}, err
}

var _ resource.ListIterator = (*rowsWrapper)(nil)

type rowsWrapper struct {
	a    *dashboardSqlAccess
	rows *sql.Rows

	canReadDashboard func(scopes ...string) bool

	// Current
	row *dashboardRow
	err error
}

func (a *dashboardSqlAccess) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]resource.ResourceStats, error) {
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
		r.row, err = r.a.scanRow(r.rows)
		if err != nil {
			r.err = err
			return false
		}

		if r.row != nil {
			d := r.row

			// Access control checker
			scopes := []string{dashboards.ScopeDashboardsProvider.GetResourceScopeUID(d.Dash.Name)}
			if d.FolderUID != "" { // Copied from searchV2... not sure the logic is right
				scopes = append(scopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(d.FolderUID))
			}
			if !r.canReadDashboard(scopes...) {
				continue
			}

			// returns the first folder it can
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

func (a *dashboardSqlAccess) scanRow(rows *sql.Rows) (*dashboardRow, error) {
	dash := &dashboard.Dashboard{
		TypeMeta:   dashboard.DashboardResourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{Annotations: make(map[string]string)},
	}
	row := &dashboardRow{Dash: dash}

	var dashboard_id int64
	var orgId int64
	var folder_uid sql.NullString
	var updated time.Time
	var updatedBy sql.NullString
	var updatedByID sql.NullInt64
	var deleted sql.NullTime

	var created time.Time
	var createdBy sql.NullString
	var createdByID sql.NullInt64
	var message sql.NullString

	var plugin_id string
	var origin_name sql.NullString
	var origin_path sql.NullString
	var origin_ts sql.NullInt64
	var origin_hash sql.NullString
	var data []byte // the dashboard JSON
	var version int64

	err := rows.Scan(&orgId, &dashboard_id, &dash.Name, &folder_uid,
		&deleted, &plugin_id,
		&origin_name, &origin_path, &origin_hash, &origin_ts,
		&created, &createdBy, &createdByID,
		&updated, &updatedBy, &updatedByID,
		&version, &message, &data,
	)

	row.token = &continueToken{orgId: orgId, id: dashboard_id}
	if err == nil {
		row.RV = getResourceVersion(dashboard_id, version)
		dash.ResourceVersion = fmt.Sprintf("%d", row.RV)
		dash.Namespace = a.namespacer(orgId)
		dash.UID = gapiutil.CalculateClusterWideUID(dash)
		dash.SetCreationTimestamp(metav1.NewTime(created))
		meta, err := utils.MetaAccessor(dash)
		if err != nil {
			return nil, err
		}
		meta.SetUpdatedTimestamp(&updated)
		meta.SetCreatedBy(getUserID(createdBy, createdByID))
		meta.SetUpdatedBy(getUserID(updatedBy, updatedByID))
		meta.SetDeprecatedInternalID(dashboard_id) //nolint:staticcheck

		if deleted.Valid {
			meta.SetDeletionTimestamp(ptr.To(metav1.NewTime(deleted.Time)))
		}

		if message.String != "" {
			meta.SetMessage(message.String)
		}
		if folder_uid.String != "" {
			meta.SetFolder(folder_uid.String)
			row.FolderUID = folder_uid.String
		}

		if origin_name.String != "" {
			ts := time.Unix(origin_ts.Int64, 0)

			resolvedPath := a.provisioning.GetDashboardProvisionerResolvedPath(origin_name.String)
			originPath, err := filepath.Rel(
				resolvedPath,
				origin_path.String,
			)
			if err != nil {
				return nil, err
			}

			meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
				Name:      origin_name.String,
				Path:      originPath,
				Hash:      origin_hash.String,
				Timestamp: &ts,
			})
		} else if plugin_id != "" {
			meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
				Name: "plugin",
				Path: plugin_id,
			})
		}

		if len(data) > 0 {
			err = dash.Spec.UnmarshalJSON(data)
			if err != nil {
				return row, err
			}
		}
		dash.Spec.Remove("id")
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
func (a *dashboardSqlAccess) DeleteDashboard(ctx context.Context, orgId int64, uid string) (*dashboard.Dashboard, bool, error) {
	dash, _, err := a.GetDashboard(ctx, orgId, uid, 0)
	if err != nil {
		return nil, false, err
	}

	if a.softDelete {
		err = a.dashStore.SoftDeleteDashboard(ctx, orgId, uid)
		if err == nil && dash != nil {
			now := metav1.NewTime(time.Now())
			dash.DeletionTimestamp = &now
			return dash, true, err
		}
		return dash, false, err
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

// SaveDashboard implements DashboardAccess.
func (a *dashboardSqlAccess) SaveDashboard(ctx context.Context, orgId int64, dash *dashboard.Dashboard) (*dashboard.Dashboard, bool, error) {
	created := false
	user, ok := claims.From(ctx)
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
		} else {
			dash.Spec.Remove("id") // existing of "id" makes it an update
			created = true
		}
	} else {
		dash.Spec.Remove("id")
		dash.Spec.Remove("uid")
	}

	var userID int64
	if claims.IsIdentityType(user.GetIdentityType(), claims.TypeUser) {
		var err error
		userID, err = identity.UserIdentifier(user.GetSubject())
		if err != nil {
			return nil, false, err
		}
	}

	meta, err := utils.MetaAccessor(dash)
	if err != nil {
		return nil, false, err
	}
	out, err := a.dashStore.SaveDashboard(ctx, dashboards.SaveDashboardCommand{
		OrgID:     orgId,
		Dashboard: simplejson.NewFromAny(dash.Spec.UnstructuredContent()),
		FolderUID: meta.GetFolder(),
		Overwrite: true, // already passed the revisionVersion checks!
		UserID:    userID,
	})
	if err != nil {
		return nil, false, err
	}
	if out != nil {
		created = (out.Created.Unix() == out.Updated.Unix()) // and now?
	}
	dash, _, err = a.GetDashboard(ctx, orgId, out.UID, 0)
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

func (a *dashboardSqlAccess) GetLibraryPanels(ctx context.Context, query LibraryPanelQuery) (*dashboard.LibraryPanelList, error) {
	limit := int(query.Limit)
	query.Limit += 1 // for continue
	if query.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	sql, err := a.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newLibraryQueryReq(sql, &query)
	rawQuery, err := sqltemplate.Execute(sqlQueryPanels, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryPanels.Name(), err)
	}
	q := rawQuery

	res := &dashboard.LibraryPanelList{}
	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()
	if err != nil {
		return nil, err
	}

	type panel struct {
		ID        int64
		UID       string
		FolderUID string

		Created   time.Time
		CreatedBy string

		Updated   time.Time
		UpdatedBy string

		Name        string
		Type        string
		Description string
		Model       []byte
	}

	var lastID int64
	for rows.Next() {
		p := panel{}
		err = rows.Scan(&p.ID, &p.UID, &p.FolderUID,
			&p.Created, &p.CreatedBy,
			&p.Updated, &p.UpdatedBy,
			&p.Name, &p.Type, &p.Description, &p.Model,
		)
		if err != nil {
			return res, err
		}
		lastID = p.ID

		item := dashboard.LibraryPanel{
			ObjectMeta: metav1.ObjectMeta{
				Name:              p.UID,
				CreationTimestamp: metav1.NewTime(p.Created),
				ResourceVersion:   strconv.FormatInt(p.Updated.UnixMilli(), 10),
			},
			Spec: dashboard.LibraryPanelSpec{},
		}

		status := &dashboard.LibraryPanelStatus{
			Missing: v0alpha1.Unstructured{},
		}
		err = json.Unmarshal(p.Model, &item.Spec)
		if err != nil {
			return nil, err
		}
		err = json.Unmarshal(p.Model, &status.Missing.Object)
		if err != nil {
			return nil, err
		}

		if item.Spec.Title != p.Name {
			status.Warnings = append(item.Status.Warnings, fmt.Sprintf("title mismatch (expected: %s)", p.Name))
		}
		if item.Spec.Description != p.Description {
			status.Warnings = append(item.Status.Warnings, fmt.Sprintf("description mismatch (expected: %s)", p.Description))
		}
		if item.Spec.Type != p.Type {
			status.Warnings = append(item.Status.Warnings, fmt.Sprintf("type mismatch (expected: %s)", p.Type))
		}
		item.Status = status

		// Remove the properties we are already showing
		for _, k := range []string{"type", "pluginVersion", "title", "description", "options", "fieldConfig", "datasource", "targets", "libraryPanel"} {
			delete(status.Missing.Object, k)
		}

		meta, err := utils.MetaAccessor(&item)
		if err != nil {
			return nil, err
		}
		meta.SetFolder(p.FolderUID)
		meta.SetCreatedBy(p.CreatedBy)
		meta.SetUpdatedBy(p.UpdatedBy)
		meta.SetUpdatedTimestamp(&p.Updated)
		meta.SetRepositoryInfo(&utils.ResourceRepositoryInfo{
			Name: "SQL",
			Path: strconv.FormatInt(p.ID, 10),
		})

		res.Items = append(res.Items, item)
		if len(res.Items) > limit {
			res.Continue = strconv.FormatInt(lastID, 10)
			break
		}
	}
	if query.UID == "" {
		rv, err := sql.GetResourceVersion(ctx, "library_element", "updated")
		if err == nil {
			res.ResourceVersion = strconv.FormatInt(rv, 10)
		}
	}
	return res, err
}
