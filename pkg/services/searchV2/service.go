package searchV2

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type StandardSearchService struct {
	sql  *sqlstore.SQLStore
	auth FutureAuthService // eventually injected from elsewhere
}

func ProvideService(sql *sqlstore.SQLStore) SearchService {
	return &StandardSearchService{
		sql: sql,
		auth: &simpleSQLAuthService{
			sql: sql,
		},
	}
}

type dashMeta struct {
	id        int64
	is_folder bool
	folder_id int64
	slug      string
	created   time.Time
	updated   time.Time
	dash      *extract.DashboardInfo
}

func (s *StandardSearchService) DoDashboardQuery(ctx context.Context, user *backend.User, orgId int64, query DashboardQuery) *backend.DataResponse {
	rsp := &backend.DataResponse{}

	// Load and parse all dashboards for given orgId
	dash, err := loadDashboards(ctx, orgId, s.sql)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	// TODO - get user from context?
	getSignedInUserQuery := &models.GetSignedInUserQuery{
		Login: user.Login,
		Email: user.Email,
		OrgId: orgId,
	}

	err = s.sql.GetSignedInUser(ctx, getSignedInUserQuery)
	if err != nil {
		fmt.Printf("error while retrieving user %s\n", err)
		rsp.Error = fmt.Errorf("auth error")
		return rsp
	}

	if getSignedInUserQuery.Result == nil {
		fmt.Printf("no user %s", user.Email)
		rsp.Error = fmt.Errorf("auth error")
		return rsp
	}

	dash, err = s.applyAuthFilter(getSignedInUserQuery.Result, dash)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	rsp.Frames = metaToFrame(dash)

	return rsp
}

func (s *StandardSearchService) applyAuthFilter(user *models.SignedInUser, dash []dashMeta) ([]dashMeta, error) {
	filter, err := s.auth.GetDashboardReadFilter(user)
	if err != nil {
		return nil, err
	}

	// create a list of all viewable dashboards for this user
	res := make([]dashMeta, 0, len(dash))
	for _, dash := range dash {
		if filter(dash.dash.UID) || (dash.is_folder && dash.dash.UID == "") { // include the "General" folder
			res = append(res, dash)
		}
	}
	return res, nil
}

type dashDataQueryResult struct {
	Id       int64
	IsFolder bool   `xorm:"is_folder"`
	FolderID int64  `xorm:"folder_id"`
	Slug     string `xorm:"slug"`
	Data     []byte
	Created  time.Time
	Updated  time.Time
}

type dsQueryResult struct {
	UID       string `xorm:"uid"`
	Type      string `xorm:"type"`
	Name      string `xorm:"name"`
	IsDefault bool   `xorm:"is_default"`
}

func loadDashboards(ctx context.Context, orgID int64, sql *sqlstore.SQLStore) ([]dashMeta, error) {
	meta := make([]dashMeta, 0, 200)

	// Add the root folder ID (does not exist in SQL)
	meta = append(meta, dashMeta{
		id:        0,
		is_folder: true,
		folder_id: 0,
		slug:      "",
		created:   time.Now(),
		updated:   time.Now(),
		dash: &extract.DashboardInfo{
			ID:    0,
			UID:   "",
			Title: "General",
		},
	})

	// key will allow name or uid
	lookup, err := loadDatasoureLookup(ctx, orgID, sql)
	if err != nil {
		return meta, err
	}

	err = sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rows := make([]*dashDataQueryResult, 0)

		sess.Table("dashboard").
			Where("org_id = ?", orgID).
			Cols("id", "is_folder", "folder_id", "data", "slug", "created", "updated")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		for _, row := range rows {
			dash := extract.ReadDashboard(bytes.NewReader(row.Data), lookup)

			meta = append(meta, dashMeta{
				id:        row.Id,
				is_folder: row.IsFolder,
				folder_id: row.FolderID,
				slug:      row.Slug,
				created:   row.Created,
				updated:   row.Updated,
				dash:      dash,
			})
		}

		return nil
	})

	return meta, err
}

func loadDatasoureLookup(ctx context.Context, orgID int64, sql *sqlstore.SQLStore) (extract.DatasourceLookup, error) {
	byUID := make(map[string]*extract.DataSourceRef, 50)
	byName := make(map[string]*extract.DataSourceRef, 50)
	var defaultDS *extract.DataSourceRef

	err := sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rows := make([]*dsQueryResult, 0)
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

type simpleCounter struct {
	values map[string]int64
}

func (c *simpleCounter) add(key string) {
	v, ok := c.values[key]
	if !ok {
		v = 0
	}
	c.values[key] = v + 1
}

func (c *simpleCounter) toFrame(name string) *data.Frame {
	key := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	val := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	for k, v := range c.values {
		key.Append(k)
		val.Append(v)
	}
	return data.NewFrame(name, key, val)
}

// UGLY... but helpful for now
func metaToFrame(meta []dashMeta) data.Frames {
	folderID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	folderUID := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	folderName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	folderDashCount := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)

	folderID.Name = "id"
	folderUID.Name = "uid"
	folderName.Name = "name"
	folderDashCount.Name = "DashCount"

	dashID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashUID := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	dashURL := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	dashFolderID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	dashDescr := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	dashCreated := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	dashUpdated := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	dashSchemaVersion := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashTags := data.NewFieldFromFieldType(data.FieldTypeNullableString, 0)
	dashPanelCount := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashVarCount := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashDSList := data.NewFieldFromFieldType(data.FieldTypeNullableString, 0)

	dashID.Name = "id"
	dashUID.Name = "uid"
	dashFolderID.Name = "folderID"
	dashName.Name = "name"
	dashDescr.Name = "description"
	dashTags.Name = "tags"
	dashSchemaVersion.Name = "SchemaVersion"
	dashCreated.Name = "Created"
	dashUpdated.Name = "Updated"
	dashURL.Name = "url"
	dashURL.Config = &data.FieldConfig{
		Links: []data.DataLink{
			{Title: "link", URL: "${__value.text}"},
		},
	}
	dashPanelCount.Name = "panelCount"
	dashVarCount.Name = "varCount"
	dashDSList.Name = "datasource"

	dashTags.Config = &data.FieldConfig{
		Custom: map[string]interface{}{
			// Table panel default styling
			"displayMode": "json-view",
		},
	}

	panelDashID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	panelID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	panelName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	panelDescr := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	panelType := data.NewFieldFromFieldType(data.FieldTypeString, 0)

	panelDashID.Name = "dashboardID"
	panelID.Name = "id"
	panelName.Name = "name"
	panelDescr.Name = "description"
	panelType.Name = "type"

	panelTypeCounter := simpleCounter{
		values: make(map[string]int64, 30),
	}

	schemaVersionCounter := simpleCounter{
		values: make(map[string]int64, 30),
	}

	folderCounter := make(map[int64]int64, 20)

	for _, row := range meta {
		if row.is_folder {
			folderID.Append(row.id)
			folderUID.Append(row.dash.UID)
			folderName.Append(row.dash.Title)
			folderDashCount.Append(int64(0)) // filled in later
			continue
		}

		dashID.Append(row.id)
		dashUID.Append(row.dash.UID)
		dashFolderID.Append(row.folder_id)
		dashName.Append(row.dash.Title)
		dashDescr.Append(row.dash.Title)
		dashSchemaVersion.Append(row.dash.SchemaVersion)
		dashCreated.Append(row.created)
		dashUpdated.Append(row.updated)

		// Increment the folder counter
		fcount, ok := folderCounter[row.folder_id]
		if !ok {
			fcount = 0
		}
		folderCounter[row.folder_id] = fcount + 1

		url := fmt.Sprintf("/d/%s/%s", row.dash.UID, row.slug)
		dashURL.Append(url)

		// stats
		schemaVersionCounter.add(strconv.FormatInt(row.dash.SchemaVersion, 10))

		dashTags.Append(toJSONString(row.dash.Tags))
		dashPanelCount.Append(int64(len(row.dash.Panels)))
		dashVarCount.Append(int64(len(row.dash.TemplateVars)))
		dashDSList.Append(dsAsJSONString(row.dash.Datasource))

		// Row for each panel
		for _, panel := range row.dash.Panels {
			panelDashID.Append(row.id)
			panelID.Append(panel.ID)
			panelName.Append(panel.Title)
			panelDescr.Append(panel.Description)
			panelType.Append(panel.Type)
			panelTypeCounter.add(panel.Type)
		}
	}

	// Update the folder counts
	for i := 0; i < folderID.Len(); i++ {
		id, ok := folderID.At(i).(int64)
		if ok {
			folderDashCount.Set(i, folderCounter[id])
		}
	}

	return data.Frames{
		data.NewFrame("folders", folderID, folderUID, folderName, folderDashCount),
		data.NewFrame("dashboards", dashID, dashUID, dashURL, dashFolderID,
			dashName, dashDescr, dashTags,
			dashSchemaVersion,
			dashPanelCount, dashVarCount, dashDSList,
			dashCreated, dashUpdated),
		data.NewFrame("panels", panelDashID, panelID, panelName, panelDescr, panelType),
		panelTypeCounter.toFrame("panel-type-counts"),
		schemaVersionCounter.toFrame("schema-version-counts"),
	}
}

func toJSONString(vals []string) *string {
	if len(vals) < 1 {
		return nil
	}
	b, err := json.Marshal(vals)
	if err == nil {
		s := string(b)
		return &s
	}
	return nil
}

func dsAsJSONString(vals []extract.DataSourceRef) *string {
	if len(vals) < 1 {
		return nil
	}
	b, err := json.Marshal(vals)
	if err == nil {
		s := string(b)
		return &s
	}
	return nil
}
