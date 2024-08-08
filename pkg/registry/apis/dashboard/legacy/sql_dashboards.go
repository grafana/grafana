package legacy

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"path/filepath"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboardsV0 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
)

var (
	_ DashboardAccess = (*dashboardSqlAccess)(nil)
)

type dashboardRow struct {
	// The numeric version for this dashboard
	RV int64

	// Dashboard resource
	Dash *dashboardsV0.Dashboard

	// The folder UID (needed for access control checks)
	FolderUID string

	// The token we can use that will start a new connection that includes
	// this same dashboard
	token *continueToken
}

type dashboardSqlAccess struct {
	sql          db.DB
	dialect      sqltemplate.Dialect
	sess         *session.SessionDB
	namespacer   request.NamespaceMapper
	dashStore    dashboards.Store
	provisioning provisioning.ProvisioningService
	currentRV    func(ctx context.Context) (int64, error)

	// Typically one... the server wrapper
	subscribers []chan *resource.WrittenEvent
	mutex       sync.Mutex
}

func NewDashboardAccess(sql db.DB,
	namespacer request.NamespaceMapper,
	dashStore dashboards.Store,
	provisioning provisioning.ProvisioningService,
) DashboardAccess {
	dialect := sqltemplate.DialectForDriver(string(sql.GetDBType()))
	if dialect == nil {
		// panic?
		// fmt.Errorf("no dialect for driver %q", driverName)
		fmt.Printf("ERROR: NO DIALECT")
	}

	sess := sql.GetSqlxSession()
	currentRV := func(ctx context.Context) (int64, error) {
		t := time.Now()
		max := ""
		err := sess.Get(ctx, &max, "SELECT MAX(updated) FROM dashboard")
		if err == nil && max != "" {
			t, _ = time.Parse(time.DateTime, max) // ignore null errors
		}
		return t.UnixMilli(), nil
	}
	if sql.GetDBType() == migrator.Postgres {
		currentRV = func(ctx context.Context) (int64, error) {
			max := time.Now()
			_ = sess.Get(ctx, &max, "SELECT MAX(updated) FROM dashboard")
			return max.UnixMilli(), nil
		}
	} else if sql.GetDBType() == migrator.MySQL {
		currentRV = func(ctx context.Context) (int64, error) {
			max := time.Now().UnixMilli()
			_ = sess.Get(ctx, &max, "SELECT UNIX_TIMESTAMP(MAX(updated)) FROM dashboard;")
			return max, nil
		}
	}

	return &dashboardSqlAccess{
		sql:          sql,
		sess:         sess,
		dialect:      dialect,
		namespacer:   namespacer,
		dashStore:    dashStore,
		provisioning: provisioning,
		currentRV:    currentRV,
	}
}

func (a *dashboardSqlAccess) getRows(ctx context.Context, query *DashboardQuery) (*rowsWrapper, error) {
	if len(query.Labels) > 0 {
		return nil, fmt.Errorf("labels not yet supported")
		// if query.Requirements.Folder != nil {
		// 	args = append(args, *query.Requirements.Folder)
		// 	sqlcmd = fmt.Sprintf("%s AND dashboard.folder_uid=?$%d", sqlcmd, len(args))
		// }
	}

	req := sqlQuery{
		SQLTemplate: sqltemplate.New(a.dialect),
		Query:       query,
	}

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

	rows, err := a.sess.Query(ctx, q, req.GetArgs()...)
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

// Value implements resource.ListIterator.
func (r *rowsWrapper) Value() []byte {
	b, err := json.Marshal(r.row.Dash)
	r.err = err
	return b
}

func (a *dashboardSqlAccess) scanRow(rows *sql.Rows) (*dashboardRow, error) {
	dash := &dashboardsV0.Dashboard{
		TypeMeta:   dashboardsV0.DashboardResourceInfo.TypeMeta(),
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

			meta.SetOriginInfo(&utils.ResourceOriginInfo{
				Name:      origin_name.String,
				Path:      originPath,
				Hash:      origin_hash.String,
				Timestamp: &ts,
			})
		} else if plugin_id != "" {
			meta.SetOriginInfo(&utils.ResourceOriginInfo{
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
		// add it so we can get it from the body later
		dash.Spec.Set("id", dashboard_id)
	}
	return row, err
}

func getUserID(v sql.NullString, id sql.NullInt64) string {
	if v.Valid && v.String != "" {
		return identity.NewTypedIDString(identity.TypeUser, v.String).String()
	}
	if id.Valid && id.Int64 == -1 {
		return identity.NewTypedIDString(identity.TypeProvisioning, "").String()
	}
	return ""
}

// DeleteDashboard implements DashboardAccess.
func (a *dashboardSqlAccess) DeleteDashboard(ctx context.Context, orgId int64, uid string) (*dashboardsV0.Dashboard, bool, error) {
	dash, _, err := a.GetDashboard(ctx, orgId, uid, 0)
	if err != nil {
		return nil, false, err
	}

	id := dash.Spec.GetNestedInt64("id")
	if id == 0 {
		return nil, false, fmt.Errorf("could not find id in saved body")
	}

	err = a.dashStore.DeleteDashboard(ctx, &dashboards.DeleteDashboardCommand{
		OrgID: orgId,
		ID:    id,
	})
	if err != nil {
		return nil, false, err
	}
	return dash, true, nil
}

// SaveDashboard implements DashboardAccess.
func (a *dashboardSqlAccess) SaveDashboard(ctx context.Context, orgId int64, dash *dashboardsV0.Dashboard) (*dashboardsV0.Dashboard, bool, error) {
	created := false
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, created, err
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

	userID, err := user.GetID().UserID()
	if err != nil {
		return nil, false, err
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
	return dash, created, err
}
