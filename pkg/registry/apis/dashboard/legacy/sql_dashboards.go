package legacy

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	claims "github.com/grafana/authlib/types"
	dashboardOG "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
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
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/user"
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
	provisioning provisioning.ProvisioningService

	// Use for writing (not reading)
	dashStore             dashboards.Store
	dashboardSearchClient legacysearcher.DashboardSearchClient

	accessControl   accesscontrol.AccessControl
	libraryPanelSvc librarypanels.Service
	userService     user.Service

	// Typically one... the server wrapper
	subscribers []chan *resource.WrittenEvent
	mutex       sync.Mutex
	log         log.Logger
}

func NewDashboardAccess(sql legacysql.LegacyDatabaseProvider,
	namespacer request.NamespaceMapper,
	dashStore dashboards.Store,
	provisioning provisioning.ProvisioningService,
	libraryPanelSvc librarypanels.Service,
	sorter sort.Service,
	accessControl accesscontrol.AccessControl,
) DashboardAccess {
	dashboardSearchClient := legacysearcher.NewDashboardSearchClient(dashStore, sorter)
	return &dashboardSqlAccess{
		sql:                   sql,
		namespacer:            namespacer,
		dashStore:             dashStore,
		provisioning:          provisioning,
		dashboardSearchClient: *dashboardSearchClient,
		libraryPanelSvc:       libraryPanelSvc,
		accessControl:         accessControl,
		log:                   log.New("dashboard.legacysql"),
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
	// if false {
	// 	 pretty := sqltemplate.RemoveEmptyLines(rawQuery)
	//	 fmt.Printf("DASHBOARD QUERY: %s [%+v] // %+v\n", pretty, req.GetArgs(), query)
	// }

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
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
		r.count++

		r.row, err = r.a.scanRow(r.rows, r.history)
		if err != nil {
			if len(r.rejected) > 1000 || r.row == nil {
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

func (a *dashboardSqlAccess) scanRow(rows *sql.Rows, history bool) (*dashboardRow, error) {
	dash := &dashboardV1.Dashboard{
		TypeMeta:   dashboardV1.DashboardResourceInfo.TypeMeta(),
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
	var apiVersion sql.NullString

	var plugin_id sql.NullString
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
		dash.SetCreationTimestamp(metav1.NewTime(created))
		meta, err := utils.MetaAccessor(dash)
		if err != nil {
			return nil, err
		}
		meta.SetUpdatedTimestamp(&updated)
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
			err = dash.Spec.UnmarshalJSON(data)
			if err != nil {
				return row, fmt.Errorf("JSON unmarshal error for: %s // %w", dash.Name, err)
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
	if claims.IsIdentityType(user.GetIdentityType(), claims.TypeUser) {
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
	CreatedBy string

	Updated   time.Time
	UpdatedBy string

	Version int64

	Name        string
	Type        string
	Description string
	Model       []byte
}

func (a *dashboardSqlAccess) GetLibraryPanels(ctx context.Context, query LibraryPanelQuery) (*dashboardV0.LibraryPanelList, error) {
	limit := int(query.Limit)
	query.Limit += 1 // for continue
	if query.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	sqlx, err := a.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newLibraryQueryReq(sqlx, &query)
	rawQuery, err := sqltemplate.Execute(sqlQueryPanels, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryPanels.Name(), err)
	}
	q := rawQuery

	res := &dashboardV0.LibraryPanelList{}
	rows, err := sqlx.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
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
		rv, err := sqlx.GetResourceVersion(ctx, "library_element", "updated")
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
	meta.SetCreatedBy(p.CreatedBy)
	meta.SetGeneration(p.Version)
	meta.SetDeprecatedInternalID(p.ID) //nolint:staticcheck

	// Only set updated metadata if it is different
	if p.UpdatedBy != p.CreatedBy || p.Updated.Sub(p.Created) > time.Second {
		meta.SetUpdatedBy(p.UpdatedBy)
		meta.SetUpdatedTimestamp(&p.Updated)
	}

	return item, nil
}

func (a *dashboardSqlAccess) DeleteLibraryPanel(ctx context.Context, orgId int64, uid string) (*dashboardV0.LibraryPanel, bool, error) {
	existingPanel, err := a.GetLibraryPanels(ctx, LibraryPanelQuery{
		OrgID: orgId,
		UID:   uid,
		Limit: 1,
	})
	if err != nil {
		return nil, false, err
	}

	if len(existingPanel.Items) == 0 {
		return nil, false, fmt.Errorf("library panel not found")
	}

	panelToDelete := existingPanel.Items[0]

	sqlx, err := a.sql(ctx)
	if err != nil {
		return nil, false, err
	}

	req := newLibraryQueryReq(sqlx, &LibraryPanelQuery{
		OrgID: orgId,
		UID:   uid,
	})

	rawQuery, err := sqltemplate.Execute(sqlDeletePanel, req)
	if err != nil {
		return nil, false, fmt.Errorf("execute template %q: %w", "delete_panel.sql", err)
	}

	_, err = sqlx.DB.GetSqlxSession().Exec(ctx, rawQuery, req.GetArgs()...)
	if err != nil {
		return nil, false, err
	}

	return &panelToDelete, true, nil
}

// TODO: reduce code duplication with libraryelements/api.go
func (a *dashboardSqlAccess) convertLibraryPanelSpecToLegacyModel(panel *dashboardV0.LibraryPanel) ([]byte, error) {
	legacyModel := map[string]any{}

	fmt.Println(panel.Spec.FieldConfig)
	// Convert the spec fields to the legacy model format
	legacyModel["datasource"] = panel.Spec.Datasource
	legacyModel["description"] = panel.Spec.Description

	// Handle fieldConfig - access the Object field directly
	if optionsJSON, err := json.Marshal(panel.Spec.FieldConfig.Object); err == nil {
		var optionsMap map[string]interface{}
		if json.Unmarshal(optionsJSON, &optionsMap) == nil {
			legacyModel["fieldConfig"] = optionsMap
		}
	}
	legacyModel["gridPos"] = panel.Spec.GridPos

	if optionsJSON, err := json.Marshal(panel.Spec.Options.Object); err == nil {
		var optionsMap map[string]interface{}
		if json.Unmarshal(optionsJSON, &optionsMap) == nil {
			legacyModel["options"] = optionsMap
		}
	}
	legacyModel["pluginVersion"] = panel.Spec.PluginVersion
	legacyModel["type"] = panel.Spec.Type
	legacyModel["title"] = panel.Spec.PanelTitle // this is the title of the panel when displayed in the dashboard
	legacyModel["libraryPanel"] = map[string]string{
		"name": panel.Spec.Title, // this is the title of the actual library panel, when displayed in the library panel list
		"uid":  panel.Name,
	}

	if len(panel.Spec.Links) > 0 {
		legacyModel["links"] = panel.Spec.Links
	}
	if len(panel.Spec.Targets) > 0 {
		legacyModel["targets"] = panel.Spec.Targets
	}
	if panel.Spec.Transparent {
		legacyModel["transparent"] = panel.Spec.Transparent
	}

	finalModel, err := json.Marshal(legacyModel)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal model: %w", err)
	}

	return finalModel, nil
}

func (a *dashboardSqlAccess) CreateLibraryPanel(ctx context.Context, orgId int64, panel *dashboardV0.LibraryPanel) (*dashboardV0.LibraryPanel, error) {
	sqlx, err := a.sql(ctx)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	meta, err := utils.MetaAccessor(panel)
	if err != nil {
		return nil, err
	}

	now := time.Now()

	modelData, err := a.convertLibraryPanelSpecToLegacyModel(panel)
	if err != nil {
		return nil, err
	}

	// we've already check if the user can create a panel, now check that they have
	// access to this particular folder
	folder := meta.GetFolder()
	if folder != "" {
		ok, err := a.accessControl.Evaluate(ctx, user, accesscontrol.EvalPermission(
			dashboards.ActionFoldersWrite,
			dashboards.ScopeFoldersProvider.GetResourceScopeUID(meta.GetFolder()),
		))
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, dashboards.ErrFolderAccessDenied
		}
	} else {
		// in legacy, uid is saved as general if no folder is specified
		folder = "general"
	}

	saveQuery := &SavePanelQuery{
		OrgID: orgId,
		// TODO: FIXME - we will need to get the folder from the folder service, we cannot join in the sql template as folder may not be in the db anymore
		// FolderID:    meta.GetFolderID(),
		FolderUID:   meta.GetFolder(),
		UID:         panel.Name,
		Name:        panel.Spec.Title,
		Kind:        1, // Panel kind
		Type:        panel.Spec.Type,
		Description: panel.Spec.Description,
		Model:       modelData,
		Version:     1,
		Created:     now,
		CreatedBy:   meta.GetCreatedBy(),
		Updated:     now,
		UpdatedBy:   meta.GetCreatedBy(),
	}

	req := newSavePanelQueryReq(sqlx, saveQuery)

	rawQuery, err := sqltemplate.Execute(sqlCreatePanel, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", "create_panel.sql", err)
	}

	_, err = sqlx.DB.GetSqlxSession().Exec(ctx, rawQuery, req.GetArgs()...)
	if err != nil {
		return nil, err
	}

	result, err := a.GetLibraryPanels(ctx, LibraryPanelQuery{
		OrgID: orgId,
		UID:   panel.Name,
		Limit: 1,
	})
	if err != nil {
		return nil, err
	}

	if len(result.Items) == 0 {
		return nil, fmt.Errorf("failed to retrieve created library panel")
	}

	return &result.Items[0], nil
}

func (a *dashboardSqlAccess) UpdateLibraryPanel(ctx context.Context, orgId int64, panel *dashboardV0.LibraryPanel) (*dashboardV0.LibraryPanel, error) {
	sqlx, err := a.sql(ctx)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	meta, err := utils.MetaAccessor(panel)
	if err != nil {
		return nil, err
	}

	// we've already check if the user can create a panel, now check that they have
	// access to this particular folder
	//
	// note: the check for the library panel uid has already been done in the authorizer
	folder := meta.GetFolder()
	if folder != "" {
		ok, err := a.accessControl.Evaluate(ctx, user, accesscontrol.EvalPermission(
			dashboards.ActionFoldersWrite,
			dashboards.ScopeFoldersProvider.GetResourceScopeUID(meta.GetFolder()),
		))
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, dashboards.ErrFolderAccessDenied
		}
	} else {
		// in legacy, uid is saved as general if no folder is specified
		folder = "general"
	}

	now := time.Now()

	existingPanel, err := a.GetLibraryPanels(ctx, LibraryPanelQuery{
		OrgID: orgId,
		UID:   panel.Name,
		Limit: 1,
	})
	if err != nil {
		return nil, err
	}

	if len(existingPanel.Items) == 0 {
		return nil, fmt.Errorf("library panel not found for update")
	}

	existing := existingPanel.Items[0]
	existingMeta, _ := utils.MetaAccessor(&existing)
	version := existingMeta.GetGeneration() + 1
	// also need to check permissions of existing folder, if it changed
	if existingMeta.GetFolder() != "" && existingMeta.GetFolder() != folder {
		ok, err := a.accessControl.Evaluate(ctx, user, accesscontrol.EvalPermission(
			dashboards.ActionFoldersWrite,
			dashboards.ScopeFoldersProvider.GetResourceScopeUID(existingMeta.GetFolder()),
		))
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, dashboards.ErrFolderAccessDenied
		}
	}

	modelData, err := a.convertLibraryPanelSpecToLegacyModel(panel)
	if err != nil {
		return nil, err
	}

	saveQuery := &SavePanelQuery{
		OrgID: orgId,
		// TODO: FIXME - we will need to get the folder from the folder service, we cannot join in the sql template as folder may not be in the db anymore
		// FolderID:    existingMeta.GetFolderID(),
		FolderUID:   folder,
		UID:         panel.Name,
		Name:        panel.Spec.Title,
		Kind:        1, // Panel kind
		Type:        panel.Spec.Type,
		Description: panel.Spec.Description,
		Model:       modelData,
		Version:     version,
		Created:     existingMeta.GetCreationTimestamp().Time,
		CreatedBy:   existingMeta.GetCreatedBy(),
		Updated:     now,
		UpdatedBy:   meta.GetUpdatedBy(),
	}

	req := newSavePanelQueryReq(sqlx, saveQuery)

	rawQuery, err := sqltemplate.Execute(sqlUpdatePanel, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", "update_panel.sql", err)
	}

	_, err = sqlx.DB.GetSqlxSession().Exec(ctx, rawQuery, req.GetArgs()...)
	if err != nil {
		return nil, err
	}

	result, err := a.GetLibraryPanels(ctx, LibraryPanelQuery{
		OrgID: orgId,
		UID:   panel.Name,
		Limit: 1,
	})
	if err != nil {
		return nil, err
	}

	if len(result.Items) == 0 {
		return nil, fmt.Errorf("failed to retrieve updated library panel")
	}

	return &result.Items[0], nil
}
