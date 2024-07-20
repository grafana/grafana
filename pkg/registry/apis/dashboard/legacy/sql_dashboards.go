package legacy

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboardsV0 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
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

	// Size (in bytes) of the dashboard payload
	Bytes int

	// The token we can use that will start a new connection that includes
	// this same dashboard
	token *continueToken
}

type dashboardSqlAccess struct {
	sql          db.DB
	sess         *session.SessionDB
	namespacer   request.NamespaceMapper
	dashStore    dashboards.Store
	provisioning provisioning.ProvisioningService

	// Typically one... the server wrapper
	subscribers []chan *resource.WrittenEvent
	mutex       sync.Mutex
}

func NewDashboardAccess(sql db.DB,
	namespacer request.NamespaceMapper,
	dashStore dashboards.Store,
	provisioning provisioning.ProvisioningService,
) DashboardAccess {
	return &dashboardSqlAccess{
		sql:          sql,
		sess:         sql.GetSqlxSession(),
		namespacer:   namespacer,
		dashStore:    dashStore,
		provisioning: provisioning,
	}
}

const selector = `SELECT
	dashboard.org_id, dashboard.id,
	dashboard.uid, dashboard.folder_uid,
	dashboard.created,CreatedUSER.uid as created_by,
	dashboard.updated,UpdatedUSER.uid as updated_by,
	dashboard.deleted, plugin_id,
	dashboard_provisioning.name as origin_name,
	dashboard_provisioning.external_id as origin_path,
	dashboard_provisioning.check_sum as origin_key,
	dashboard_provisioning.updated as origin_ts,
	dashboard.version, '', dashboard.data
  FROM dashboard
  LEFT OUTER JOIN dashboard_provisioning ON dashboard.id = dashboard_provisioning.dashboard_id
  LEFT OUTER JOIN user AS CreatedUSER ON dashboard.created_by = CreatedUSER.id
  LEFT OUTER JOIN user AS UpdatedUSER ON dashboard.updated_by = UpdatedUSER.id
  WHERE dashboard.is_folder = false`

const history = `SELECT
	dashboard.org_id, dashboard.id,
	dashboard.uid, dashboard.folder_uid,
	dashboard.created,CreatedUSER.uid as created_by,
	dashboard_version.created,UpdatedUSER.uid as updated_by,
	NULL, plugin_id,
	dashboard_provisioning.name as origin_name,
	dashboard_provisioning.external_id as origin_path,
	dashboard_provisioning.check_sum as origin_key,
	dashboard_provisioning.updated as origin_ts,
	dashboard_version.version, dashboard_version.message, dashboard_version.data
  FROM dashboard
  LEFT OUTER JOIN dashboard_provisioning ON dashboard.id = dashboard_provisioning.dashboard_id
  LEFT OUTER JOIN dashboard_version  ON dashboard.id = dashboard_version.dashboard_id
  LEFT OUTER JOIN user AS CreatedUSER ON dashboard.created_by = CreatedUSER.id
  LEFT OUTER JOIN user AS UpdatedUSER ON dashboard_version.created_by = UpdatedUSER.id
  WHERE dashboard.is_folder = false`

func (a *dashboardSqlAccess) getRows(ctx context.Context, query *DashboardQuery) (*rowsWrapper, int, error) {
	if len(query.Labels) > 0 {
		return nil, 0, fmt.Errorf("labels not yet supported")
		// if query.Requirements.Folder != nil {
		// 	args = append(args, *query.Requirements.Folder)
		// 	sqlcmd = fmt.Sprintf("%s AND dashboard.folder_uid=$%d", sqlcmd, len(args))
		// }
	}

	var sqlcmd string
	args := []any{query.OrgID}

	limit := query.Limit
	if limit < 1 {
		limit = 15 //
	}

	if query.GetHistory || query.Version > 0 {
		if query.GetTrash {
			return nil, 0, fmt.Errorf("trash not included in history table")
		}

		sqlcmd = fmt.Sprintf("%s AND dashboard.org_id=$%d\n  ", history, len(args))

		if query.UID == "" {
			return nil, 0, fmt.Errorf("history query must have a UID")
		}

		args = append(args, query.UID)
		sqlcmd = fmt.Sprintf("%s AND dashboard.uid=$%d", sqlcmd, len(args))

		if query.Version > 0 {
			args = append(args, query.Version)
			sqlcmd = fmt.Sprintf("%s AND dashboard_version.version=$%d", sqlcmd, len(args))
		} else if query.LastID > 0 {
			args = append(args, query.LastID)
			sqlcmd = fmt.Sprintf("%s AND dashboard_version.version<$%d", sqlcmd, len(args))
		}

		args = append(args, (limit + 2)) // add more so we can include a next token
		sqlcmd = fmt.Sprintf("%s\n   ORDER BY dashboard_version.version desc LIMIT $%d", sqlcmd, len(args))
	} else {
		sqlcmd = fmt.Sprintf("%s AND dashboard.org_id=$%d\n  ", selector, len(args))

		if query.UID != "" {
			args = append(args, query.UID)
			sqlcmd = fmt.Sprintf("%s AND dashboard.uid=$%d", sqlcmd, len(args))
		} else if query.LastID > 0 {
			args = append(args, query.LastID)
			sqlcmd = fmt.Sprintf("%s AND dashboard.id>=$%d", sqlcmd, len(args))
		}
		if query.GetTrash {
			sqlcmd = sqlcmd + " AND dashboard.deleted IS NOT NULL"
		} else {
			sqlcmd = sqlcmd + " AND dashboard.deleted IS NULL"
		}

		args = append(args, (limit + 2)) // add more so we can include a next token
		sqlcmd = fmt.Sprintf("%s\n   ORDER BY dashboard.id asc LIMIT $%d", sqlcmd, len(args))
	}
	// fmt.Printf("%s // %v\n", sqlcmd, args)

	rows, err := a.doQuery(ctx, sqlcmd, args...)
	if err != nil {
		if rows != nil {
			_ = rows.Close()
		}
		rows = nil
	}
	return rows, limit, err
}

func (a *dashboardSqlAccess) doQuery(ctx context.Context, query string, args ...any) (*rowsWrapper, error) {
	_, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := a.sess.Query(ctx, query, args...)
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

type rowsWrapper struct {
	a     *dashboardSqlAccess
	rows  *sql.Rows
	idx   int
	total int64

	canReadDashboard func(scopes ...string) bool
}

func (r *rowsWrapper) Close() error {
	return r.rows.Close()
}

func (r *rowsWrapper) Next() (*dashboardRow, error) {
	// breaks after first readable value
	for r.rows.Next() {
		r.idx++
		d, err := r.a.scanRow(r.rows)
		if d != nil {
			// Access control checker
			scopes := []string{dashboards.ScopeDashboardsProvider.GetResourceScopeUID(d.Dash.Name)}
			if d.FolderUID != "" { // Copied from searchV2... not sure the logic is right
				scopes = append(scopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(d.FolderUID))
			}
			if !r.canReadDashboard(scopes...) {
				continue
			}
			r.total += int64(d.Bytes)
		}

		// returns the first folder it can
		return d, err
	}
	return nil, nil
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
	var deleted sql.NullTime

	var created time.Time
	var createdBy sql.NullString
	var message sql.NullString

	var plugin_id string
	var origin_name sql.NullString
	var origin_path sql.NullString
	var origin_ts sql.NullInt64
	var origin_hash sql.NullString
	var data []byte // the dashboard JSON
	var version int64

	err := rows.Scan(&orgId, &dashboard_id, &dash.Name, &folder_uid,
		&created, &createdBy,
		&updated, &updatedBy,
		&deleted, &plugin_id,
		&origin_name, &origin_path, &origin_hash, &origin_ts,
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
		meta.SetCreatedBy(getUserID(createdBy))
		meta.SetUpdatedBy(getUserID(updatedBy))

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

		row.Bytes = len(data)
		if row.Bytes > 0 {
			err = dash.Spec.UnmarshalJSON(data)
			if err != nil {
				return row, err
			}
			dash.Spec.Set("id", dashboard_id) // add it so we can get it from the body later
		}
	}
	return row, err
}

func getUserID(v sql.NullString) string {
	if v.String == "" {
		return identity.NewNamespaceIDString(identity.NamespaceProvisioning, "").String()
	}
	return identity.NewNamespaceIDString(identity.NamespaceUser, v.String).String()
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
	user, err := appcontext.User(ctx)
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

	meta, err := utils.MetaAccessor(dash)
	if err != nil {
		return nil, false, err
	}
	out, err := a.dashStore.SaveDashboard(ctx, dashboards.SaveDashboardCommand{
		OrgID:     orgId,
		Dashboard: simplejson.NewFromAny(dash.Spec.UnstructuredContent()),
		FolderUID: meta.GetFolder(),
		Overwrite: true, // already passed the revisionVersion checks!
		UserID:    user.UserID,
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
