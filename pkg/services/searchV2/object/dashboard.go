package object

import (
	"bytes"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/searchV2/dslookup"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
	"github.com/grafana/grafana/pkg/services/store/object"
)

func NewDashboardSummaryBuilder(lookup dslookup.DatasourceLookup) object.ObjectSummaryBuilder {
	return func(obj *object.RawObject) (object.ObjectSummary, error) {
		summary := object.ObjectSummary{
			Labels: make(map[string]string),
			Fields: make(map[string]interface{}),
		}
		stream := bytes.NewBuffer(obj.Body)
		dash, err := extract.ReadDashboard(stream, lookup)
		if err != nil {
			summary.Error = &object.ObjectErrorInfo{
				Code:    500, // generic bad error
				Message: err.Error(),
			}
			return summary, err
		}

		dashboardRefs := object.NewReferenceAccumulator()
		url := fmt.Sprintf("/d/%s/%s", obj.UID, models.SlugifyTitle(dash.Title))
		summary.Name = dash.Title
		summary.Description = dash.Description
		summary.URL = url
		for _, v := range dash.Tags {
			summary.Labels[v] = ""
		}
		if len(dash.TemplateVars) > 0 {
			summary.Fields["hasTemplateVars"] = true
		}

		for _, panel := range dash.Panels {
			panelRefs := object.NewReferenceAccumulator()
			p := &object.ObjectSummary{
				UID:  obj.UID + "#" + strconv.FormatInt(panel.ID, 10),
				Kind: "panel",
			}
			p.Name = panel.Title
			p.Description = panel.Description
			p.URL = fmt.Sprintf("%s?viewPanel=%d", url, panel.ID)
			p.Fields = make(map[string]interface{}, 0)

			panelRefs.Add("panel", panel.Type, "")
			for _, v := range panel.Datasource {
				dashboardRefs.Add(object.StandardKindDataSource, v.Type, v.UID)
				panelRefs.Add(object.StandardKindDataSource, v.Type, v.UID)
			}

			for _, v := range panel.Transformer {
				panelRefs.Add(object.StandardKindTransform, v, "")
			}

			dashboardRefs.Add(object.StandardKindPanel, panel.Type, "")
			p.References = panelRefs.Get()
			summary.Nested = append(summary.Nested, p)
		}

		summary.References = dashboardRefs.Get()
		return summary, nil
	}
}
