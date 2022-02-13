package searchV2

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type StandardSearchService struct {
	sql *sqlstore.SQLStore
}

func ProvideService(sql *sqlstore.SQLStore) SearchService {
	return &StandardSearchService{
		sql: sql,
	}
}

type dashMeta struct {
	id        int64
	is_folder bool
	folder_id int64
	created   time.Time
	updated   time.Time
	dash      *extract.DashboardInfo
}

func (s *StandardSearchService) DoDashboardQuery(ctx context.Context, user *backend.User, orgId int64, query DashboardQuery) *backend.DataResponse {
	rsp := &backend.DataResponse{}

	if user == nil {
		rsp.Error = fmt.Errorf("no user found in request")
		return rsp
	}

	var orgRole models.RoleType
	switch user.Role {
	case "Admin":
		orgRole = models.ROLE_ADMIN
	case "Editor":
		orgRole = models.ROLE_EDITOR
	default:
		orgRole = models.ROLE_VIEWER
	}

	// Up to 1000 results returned with this query.
	// May require several requests to load all dashboard IDs.
	dashboardQuery := search.FindPersistedDashboardsQuery{
		Title: "",
		SignedInUser: &models.SignedInUser{
			UserId:  user.UserID,
			OrgRole: orgRole,
			OrgId:   orgId,
		},
		Type:       "",
		Limit:      0,
		Page:       0,
		Permission: models.PERMISSION_VIEW,
	}

	if err := bus.Dispatch(ctx, &dashboardQuery); err != nil {
		return nil
	}

	hits := dashboardQuery.Result

	var dashboardIDs []int64
	for _, h := range hits {
		dashboardIDs = append(dashboardIDs, h.ID)
	}

	// Load and parse all dashboards for orgId=1
	dash, err := loadDashboards(ctx, orgId, s.sql, dashboardIDs)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	rsp.Frames = metaToFrame(dash)

	return rsp
}

type dashDataQueryResult struct {
	Id       int64
	IsFolder bool  `xorm:"is_folder"`
	FolderID int64 `xorm:"folder_id"`
	Data     []byte
	Created  time.Time
	Updated  time.Time
}

func loadDashboards(ctx context.Context, orgID int64, sql *sqlstore.SQLStore, dashboardIDs []int64) ([]dashMeta, error) {
	meta := make([]dashMeta, 0, 200)

	// key will allow name or uid
	lookup := func(key string) *extract.DatasourceInfo {
		return nil // TODO!
	}

	err := sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rows := make([]*dashDataQueryResult, 0)

		sess.Table("dashboard").
			Where("org_id = ?", orgID).In("id", dashboardIDs).
			Cols("id", "is_folder", "folder_id", "data", "created", "updated")

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
				created:   row.Created,
				updated:   row.Updated,
				dash:      dash,
			})
		}

		return nil
	})

	return meta, err
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

	folderID.Name = "ID"
	folderUID.Name = "UID"
	folderName.Name = "Name"

	dashID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashUID := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	dashFolderID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	dashDescr := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	dashCreated := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	dashUpdated := data.NewFieldFromFieldType(data.FieldTypeTime, 0)
	dashSchemaVersion := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	dashTags := data.NewFieldFromFieldType(data.FieldTypeNullableString, 0)

	dashID.Name = "ID"
	dashUID.Name = "UID"
	dashFolderID.Name = "FolderID"
	dashName.Name = "Name"
	dashDescr.Name = "Description"
	dashTags.Name = "Tags"
	dashSchemaVersion.Name = "SchemaVersion"
	dashCreated.Name = "Created"
	dashUpdated.Name = "Updated"

	panelDashID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	panelID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	panelName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	panelDescr := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	panelType := data.NewFieldFromFieldType(data.FieldTypeString, 0)

	panelDashID.Name = "DashboardID"
	panelID.Name = "ID"
	panelName.Name = "Name"
	panelDescr.Name = "Description"
	panelType.Name = "Type"

	// fID.Name = "ID"
	// fUID.Name = "UID"
	// fPanelID.Name = "Panel ID"
	// fName.Name = "Name"
	// fDescr.Name = "Description"
	// fType.Name = "Panel type"
	// fTags.Name = "Tags"
	// fTags.Config = &data.FieldConfig{
	// 	Custom: map[string]interface{}{
	// 		// Table panel default styling
	// 		"displayMode": "json-view",
	// 	},
	// }

	counter := simpleCounter{
		values: make(map[string]int64, 30),
	}

	var tags *string
	for _, row := range meta {
		if row.is_folder {
			folderID.Append(row.id)
			folderUID.Append(row.dash.UID)
			folderName.Append(row.dash.Title)
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

		// Send tags as JSON array
		tags = nil
		if len(row.dash.Tags) > 0 {
			b, err := json.Marshal(row.dash.Tags)
			if err == nil {
				s := string(b)
				tags = &s
			}
		}
		dashTags.Append(tags)

		// Row for each panel
		for _, panel := range row.dash.Panels {
			panelDashID.Append(row.id)
			panelID.Append(panel.ID)
			panelName.Append(panel.Title)
			panelDescr.Append(panel.Description)
			panelType.Append(panel.Type)
			counter.add(panel.Type)
		}
	}

	return data.Frames{
		data.NewFrame("folders", folderID, folderUID, folderName),
		data.NewFrame("dashboards", dashID, dashUID, dashFolderID, dashName, dashDescr, dashTags, dashSchemaVersion, dashCreated, dashUpdated),
		data.NewFrame("panels", panelDashID, panelID, panelName, panelDescr, panelType),
		counter.toFrame("panel-type-counts"),
	}
}
