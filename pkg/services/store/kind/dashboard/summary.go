package dashboard

import (
	"bytes"
	"context"
	"encoding/json"
	"strconv"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

func GetEntityKindInfo() entity.EntityKindInfo {
	return entity.EntityKindInfo{
		ID:          entity.StandardKindDashboard,
		Name:        "Dashboard",
		Description: "Define a grafana dashboard layout",
	}
}

// This summary does not resolve old name as UID
func GetEntitySummaryBuilder() entity.EntitySummaryBuilder {
	builder := NewStaticDashboardSummaryBuilder(&directLookup{}, true)
	return func(ctx context.Context, uid string, body []byte) (*entity.EntitySummary, []byte, error) {
		return builder(ctx, uid, body)
	}
}

// This implementation moves datasources referenced by internal ID or name to UID
func NewStaticDashboardSummaryBuilder(lookup DatasourceLookup, sanitize bool) entity.EntitySummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*entity.EntitySummary, []byte, error) {
		var parsed map[string]interface{}

		if sanitize {
			err := json.Unmarshal(body, &parsed)
			if err != nil {
				return nil, nil, err // did not parse
			}
			// values that should be managed by the container
			delete(parsed, "uid")
			delete(parsed, "version")
			// slug? (derived from title)
		}

		summary := &entity.EntitySummary{
			Labels: make(map[string]string),
			Fields: make(map[string]interface{}),
		}
		stream := bytes.NewBuffer(body)
		dash, err := readDashboard(stream, lookup)
		if err != nil {
			summary.Error = &entity.EntityErrorInfo{
				Message: err.Error(),
			}
			return summary, body, err
		}

		dashboardRefs := NewReferenceAccumulator()
		summary.Name = dash.Title
		summary.Description = dash.Description
		for _, v := range dash.Tags {
			summary.Labels[v] = ""
		}
		if len(dash.TemplateVars) > 0 {
			summary.Fields["hasTemplateVars"] = true
		}
		summary.Fields["schemaVersion"] = dash.SchemaVersion

		for _, panel := range dash.Panels {
			panelRefs := NewReferenceAccumulator()
			p := &entity.EntitySummary{
				UID:  uid + "#" + strconv.FormatInt(panel.ID, 10),
				Kind: "panel",
			}
			p.Name = panel.Title
			p.Description = panel.Description
			p.Fields = make(map[string]interface{}, 0)
			p.Fields["type"] = panel.Type

			if panel.Type != "row" {
				panelRefs.Add(entity.ExternalEntityReferencePlugin, string(plugins.Panel), panel.Type)
				dashboardRefs.Add(entity.ExternalEntityReferencePlugin, string(plugins.Panel), panel.Type)
			}
			for _, v := range panel.Datasource {
				dashboardRefs.Add(entity.StandardKindDataSource, v.Type, v.UID)
				panelRefs.Add(entity.StandardKindDataSource, v.Type, v.UID)
				if v.Type != "" {
					dashboardRefs.Add(entity.ExternalEntityReferencePlugin, string(plugins.DataSource), v.Type)
				}
			}
			for _, v := range panel.Transformer {
				panelRefs.Add(entity.ExternalEntityReferenceRuntime, entity.ExternalEntityReferenceRuntime_Transformer, v)
				dashboardRefs.Add(entity.ExternalEntityReferenceRuntime, entity.ExternalEntityReferenceRuntime_Transformer, v)
			}
			p.References = panelRefs.Get()
			summary.Nested = append(summary.Nested, p)
		}

		summary.References = dashboardRefs.Get()
		if sanitize {
			body, err = json.MarshalIndent(parsed, "", "  ")
		}
		return summary, body, err
	}
}
