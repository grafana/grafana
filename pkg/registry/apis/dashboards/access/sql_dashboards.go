package access

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/util"
)

var (
	_ DashboardAccess = (*dashboardSqlAccess)(nil)
	_ DashboardRows   = (*rowsWrapper)(nil)
)

type dashboardSqlAccess struct {
	sql        db.DB
	sess       *session.SessionDB
	namespacer request.NamespaceMapper
}

func NewDashboardAccess(sql db.DB, namespacer request.NamespaceMapper) DashboardAccess {
	return &dashboardSqlAccess{
		sql:        sql,
		sess:       sql.GetSqlxSession(),
		namespacer: namespacer,
	}
}

const selector = `SELECT 
	dashboard.org_id,
	dashboard.uid,
	slug,title,
	dashboard.folder_uid,
	dashboard.created,dashboard.created_by,CreatedUSER.login,
	dashboard.updated,dashboard.updated_by,UpdatedUSER.login,
	plugin_id,
	dashboard_provisioning.name as origin_name,
	dashboard_provisioning.external_id as origin_path,
	dashboard_provisioning.check_sum as origin_key,
	dashboard_provisioning.updated as origin_ts,
	dashboard.data,dashboard.version
  FROM dashboard 
  LEFT OUTER JOIN dashboard_provisioning ON dashboard.id = dashboard_provisioning.dashboard_id
  LEFT OUTER JOIN user AS CreatedUSER ON dashboard.created_by = CreatedUSER.id 
  LEFT OUTER JOIN user AS UpdatedUSER ON dashboard.created_by = UpdatedUSER.id 
  WHERE is_folder = false`

// GetDashboard implements DashboardAccess.
func (a *dashboardSqlAccess) GetDashboard(ctx context.Context, orgId int64, uid string) (*v0alpha1.Dashboard, error) {
	rows, err := a.sess.Query(ctx, selector+`
		AND dashboard.org_id=$1
		AND dashboard.uid=$2`, orgId, uid)

	if err != nil {
		return nil, err
	}

	defer func() { _ = rows.Close() }()

	if rows.Next() {
		row, _, err := a.scanRow(rows)
		if err != nil {
			return nil, err
		}
		return row.Dash, err
	}
	return nil, k8serrors.NewNotFound(v0alpha1.DashboardResourceInfo.GroupResource(), uid)
}

// GetDashboards implements DashboardAccess.
func (a *dashboardSqlAccess) GetDashboards(ctx context.Context, orgId int64, continueToken string) (DashboardRows, error) {
	token, err := readContinueToken(continueToken)
	if err != nil {
		return nil, err
	}
	rows, err := a.sess.Query(ctx, selector+`
		AND dashboard.org_id=$1
		AND dashboard.created >= $2
		ORDER BY dashboard.org_id asc,dashboard.updated asc	
	`, orgId, time.UnixMilli(token.updated))
	if err != nil {
		return nil, err
	}
	wrap := &rowsWrapper{rows: rows, a: a}
	wrap.advanceToUID(token.uid)
	return wrap, nil
}

type rowsWrapper struct {
	a     *dashboardSqlAccess
	rows  *sql.Rows
	idx   int
	total int64

	pending *DashboardRow
}

func (r *rowsWrapper) advanceToUID(uid string) {
	if uid != "" {
		for {
			row, err := r.Next()
			if row == nil || err != nil {
				return // ??
			}
			if row.Dash.Name == uid {
				r.pending = row
				return
			}
		}
	}
}

func (r *rowsWrapper) Close() error {
	return r.rows.Close()
}

func (r *rowsWrapper) Next() (*DashboardRow, error) {
	if r.pending != nil {
		row := r.pending
		r.pending = nil
		return row, nil
	}

	if r.rows.Next() {
		d, token, err := r.a.scanRow(r.rows)
		if d != nil {
			token.row = r.idx
			token.size = r.total
			d.ContinueToken = token.String()
			r.idx++
			r.total += int64(d.Bytes)
		}
		return d, err
	}
	return nil, nil
}

func (a *dashboardSqlAccess) scanRow(rows *sql.Rows) (*DashboardRow, continueToken, error) {
	dash := &v0alpha1.Dashboard{
		TypeMeta:   v0alpha1.DashboardResourceInfo.TypeMeta(),
		ObjectMeta: v1.ObjectMeta{Annotations: make(map[string]string)},
	}
	row := &DashboardRow{Dash: dash}

	var orgId int64
	var slug string
	var title string
	var folder_uid sql.NullString
	var updated time.Time
	var updatedByID int64
	var updatedByName sql.NullString

	var created time.Time
	var createdByID int64
	var createdByName sql.NullString

	var plugin_id string
	var origin_name sql.NullString
	var origin_path sql.NullString
	var origin_ts sql.NullInt64
	var origin_key sql.NullString
	var data []byte // the dashboard JSON
	var version int64

	err := rows.Scan(&orgId, &dash.Name,
		&slug, &title, &folder_uid,
		&created, &createdByID, &createdByName,
		&updated, &updatedByID, &updatedByName,
		&plugin_id,
		&origin_name, &origin_path, &origin_key, &origin_ts,
		&data, &version,
	)

	token := continueToken{orgId: orgId, uid: dash.Name}
	if err == nil {
		token.updated = updated.UnixMilli()
		dash.ResourceVersion = fmt.Sprintf("%d", created.UnixMilli())
		dash.Namespace = a.namespacer(orgId)
		dash.SetCreationTimestamp(v1.NewTime(created))
		meta := kinds.MetaAccessor(dash)
		meta.SetUpdatedTimestamp(&updated)
		meta.SetSlug(slug)
		if createdByID > 0 {
			meta.SetCreatedBy(fmt.Sprintf("user:%d/%s", createdByID, createdByName.String))
		}
		if updatedByID > 0 {
			meta.SetUpdatedBy(fmt.Sprintf("user:%d/%s", updatedByID, updatedByName.String))
		}
		if folder_uid.Valid {
			meta.SetFolder(folder_uid.String)
		}

		if origin_name.Valid {
			ts := time.Unix(origin_ts.Int64, 0)
			meta.SetOriginInfo(&kinds.ResourceOriginInfo{
				Name:      origin_name.String,
				Path:      origin_path.String, // TODO, strip prefix!!!
				Key:       origin_key.String,
				Timestamp: &ts,
			})
		} else if plugin_id != "" {
			meta.SetOriginInfo(&kinds.ResourceOriginInfo{
				Name: "plugin",
				Path: plugin_id,
			})
		}

		row.Bytes = len(data)
		if row.Bytes > 0 {
			dash.Spec, err = simplejson.NewJson(data)
			if err != nil {
				return row, token, err
			}
			dash.Spec.Del("id") // remove the internal ID field
		}
	}
	return row, token, err
}

type continueToken struct {
	orgId   int64
	updated int64
	uid     string
	row     int
	size    int64
}

func readContinueToken(t string) (continueToken, error) {
	var err error
	token := continueToken{}
	if t == "" {
		return token, nil
	}
	parts := strings.Split(t, "/")
	if len(parts) < 3 {
		return token, fmt.Errorf("invalid continue token (too few parts)")
	}
	sub := strings.Split(parts[0], ":")
	if sub[0] != "org" {
		return token, fmt.Errorf("expected org in first slug")
	}
	token.orgId, err = strconv.ParseInt(sub[1], 10, 64)
	if err != nil {
		return token, fmt.Errorf("error parsing orgid")
	}

	sub = strings.Split(parts[1], ":")
	if sub[0] != "updated" {
		return token, fmt.Errorf("expected updated in second slug")
	}
	token.updated, err = strconv.ParseInt(sub[1], 10, 64)
	if err != nil {
		return token, fmt.Errorf("error parsing updated")
	}

	sub = strings.Split(parts[2], ":")
	if sub[0] != "uid" {
		return token, fmt.Errorf("expected uid in third slug")
	}
	token.uid = sub[1]

	return token, err
}

func (r *continueToken) String() string {
	return fmt.Sprintf("org:%d/updated:%d/uid:%s/row:%d/%s",
		r.orgId, r.updated, r.uid, r.row, util.ByteCountSI(r.size))
}
