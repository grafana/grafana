package searchV2

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/models"
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
	dash      *extract.DashboardInfo
}

func (s *StandardSearchService) DoDashboardQuery(ctx context.Context, user *backend.User, orgId int64, query DashboardQuery) *backend.DataResponse {
	rsp := &backend.DataResponse{}

	if user == nil || user.Role != string(models.ROLE_ADMIN) {
		rsp.Error = fmt.Errorf("search is only supported for admin users while in early development")
		return rsp
	}

	// Load and parse all dashboards for given orgId
	dash, err := loadDashboards(ctx, orgId, s.sql)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	rsp.Frames = append(rsp.Frames, metaToFrame(dash))

	return rsp
}

type dashDataQueryResult struct {
	Id       int64
	IsFolder bool
	Data     []byte
}

func loadDashboards(ctx context.Context, orgID int64, sql *sqlstore.SQLStore) ([]dashMeta, error) {
	meta := make([]dashMeta, 0, 200)

	// key will allow name or uid
	lookup := func(key string) *extract.DatasourceInfo {
		return nil // TODO!
	}

	err := sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		rows := make([]*dashDataQueryResult, 0)

		sess.Table("dashboard").Where("org_id = ?", orgID).Cols("id", "is_folder", "data")
		err := sess.Find(&rows)

		if err != nil {
			return err
		}

		for _, row := range rows {
			dash := extract.ReadDashboard(bytes.NewReader(row.Data), lookup)

			meta = append(meta, dashMeta{
				id:        row.Id,
				is_folder: row.IsFolder,
				dash:      dash,
			})
		}

		return nil
	})

	return meta, err
}

// UGLY... but helpful for now
func metaToFrame(meta []dashMeta) *data.Frame {
	fUID := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fPanelID := data.NewFieldFromFieldType(data.FieldTypeInt64, 0)
	fName := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fDescr := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fType := data.NewFieldFromFieldType(data.FieldTypeString, 0)
	fTags := data.NewFieldFromFieldType(data.FieldTypeNullableString, 0)

	fUID.Name = "UID"
	fPanelID.Name = "Panel ID"
	fName.Name = "Name"
	fDescr.Name = "Description"
	fType.Name = "Panel type"
	fTags.Name = "Tags"
	fTags.Config = &data.FieldConfig{
		Custom: map[string]interface{}{
			// Table panel default styling
			"displayMode": "json-view",
		},
	}

	var tags *string
	for _, row := range meta {
		fUID.Append(row.dash.UID)
		fPanelID.Append(int64(0))
		fName.Append(row.dash.Title)
		fDescr.Append(row.dash.Description)
		fType.Append("") // or null?

		// Send tags as JSON array
		tags = nil
		if len(row.dash.Tags) > 0 {
			b, err := json.Marshal(row.dash.Tags)
			if err == nil {
				s := string(b)
				tags = &s
			}
		}
		fTags.Append(tags)

		// Row for each panel
		for _, panel := range row.dash.Panels {
			fUID.Append(row.dash.UID)
			fPanelID.Append(panel.ID)
			fName.Append(panel.Title)
			fDescr.Append(panel.Description)
			fType.Append(panel.Type)
			fTags.Append(nil)
		}
	}

	return data.NewFrame("", fUID, fPanelID, fName, fDescr, fType, fTags)
}
