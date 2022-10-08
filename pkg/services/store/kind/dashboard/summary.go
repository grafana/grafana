package dashboard

import (
	"bytes"
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/store"
)

func GetObjectKindInfo() models.ObjectKindInfo {
	return models.ObjectKindInfo{
		ID:          models.StandardKindDashboard,
		Name:        "Dashboard",
		Description: "Define a grafana dashboard layout",
	}
}

func NewDashboardSummary(sql *sqlstore.SQLStore) models.ObjectSummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.ObjectSummary, []byte, error) {
		// This just gets the orgID (that will soon/eventually be encoded in a GRN and passed instead of a UID)
		user := store.UserFromContext(ctx)
		if user == nil {
			return nil, nil, fmt.Errorf("can not find user in context")
		}

		// Totally inefficient to look this up every time, but for the current use case that is OK
		// The lookup is currently structured to support searchV2, but I think should become a real fallback
		// that is only executed when we find a legacy dashboard ref
		lookup, err := LoadDatasourceLookup(ctx, user.OrgID, sql)
		if err != nil {
			return nil, nil, err
		}
		builder := NewStaticDashboardSummaryBuilder(lookup)
		return builder(ctx, uid, body)
	}
}

func NewStaticDashboardSummaryBuilder(lookup DatasourceLookup) models.ObjectSummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.ObjectSummary, []byte, error) {
		summary := &models.ObjectSummary{
			Labels: make(map[string]string),
			Fields: make(map[string]interface{}),
		}
		stream := bytes.NewBuffer(body)
		dash, err := readDashboard(stream, lookup)
		if err != nil {
			summary.Error = &models.ObjectErrorInfo{
				Message: err.Error(),
			}
			return summary, body, err
		}

		dashboardRefs := NewReferenceAccumulator()
		url := fmt.Sprintf("/d/%s/%s", uid, models.SlugifyTitle(dash.Title))
		summary.Name = dash.Title
		summary.Description = dash.Description
		summary.URL = url
		for _, v := range dash.Tags {
			summary.Labels[v] = ""
		}
		if len(dash.TemplateVars) > 0 {
			summary.Fields["hasTemplateVars"] = true
		}
		summary.Fields["schemaVersion"] = dash.SchemaVersion

		for _, panel := range dash.Panels {
			panelRefs := NewReferenceAccumulator()
			p := &models.ObjectSummary{
				UID:  uid + "#" + strconv.FormatInt(panel.ID, 10),
				Kind: "panel",
			}
			p.Name = panel.Title
			p.Description = panel.Description
			p.URL = fmt.Sprintf("%s?viewPanel=%d", url, panel.ID)
			p.Fields = make(map[string]interface{}, 0)

			panelRefs.Add("panel", panel.Type, "")
			for _, v := range panel.Datasource {
				dashboardRefs.Add(models.StandardKindDataSource, v.Type, v.UID)
				panelRefs.Add(models.StandardKindDataSource, v.Type, v.UID)
			}

			for _, v := range panel.Transformer {
				panelRefs.Add(models.StandardKindTransform, v, "")
			}

			dashboardRefs.Add(models.StandardKindPanel, panel.Type, "")
			p.References = panelRefs.Get()
			summary.Nested = append(summary.Nested, p)
		}

		summary.References = dashboardRefs.Get()
		return summary, body, nil
	}
}
