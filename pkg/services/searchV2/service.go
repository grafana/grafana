package searchV2

import (
	"bytes"
	"context"

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
	dash      *extract.DashboardInfo
}

func (s *StandardSearchService) DoDashboardQuery(ctx context.Context, query DashboardQuery) *backend.DataResponse {
	rsp := &backend.DataResponse{}

	dash, err := loadDashboards(ctx, s.sql)
	if err != nil {
		rsp.Error = err
		return rsp
	}

	rsp.Frames = append(rsp.Frames, metaToFrame(dash))

	return rsp
}

func loadDashboards(ctx context.Context, sql *sqlstore.SQLStore) ([]dashMeta, error) {
	meta := make([]dashMeta, 0, 200)

	// key will allow name or uid
	lookup := func(key string) *extract.DatasourceInfo {
		return nil // TODO!
	}

	err := sql.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// alertRules := make([]*ngmodels.AlertRule, 0)
		// q := "SELECT * FROM alert_rule WHERE org_id = ?"
		// params := []interface{}{query.OrgID}

		res, err := sess.Query("SELECT id,is_folder,data FROM dashboard") // TODO -- limit by orgID!!!
		if err != nil {
			return err
		}

		for _, row := range res {
			// id := row["id"]
			// is_folder := row["is_folder"]
			dash := extract.ReadDashboard(bytes.NewReader(row["data"]), lookup)

			meta = append(meta, dashMeta{
				id:        1,
				is_folder: false,
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

	fUID.Name = "UID"
	fPanelID.Name = "Panel ID"
	fName.Name = "Name"
	fDescr.Name = "Description"

	for _, row := range meta {
		fUID.Append(row.dash.UID)
		fPanelID.Append(int64(0))
		fName.Append(row.dash.Title)
		fDescr.Append(row.dash.Description)

		for _, panel := range row.dash.Panels {
			fUID.Append(row.dash.UID)
			fPanelID.Append(panel.ID)
			fName.Append(panel.Title)
			fDescr.Append(panel.Description)
		}
	}

	return data.NewFrame("", fUID, fPanelID, fName, fDescr)
}
