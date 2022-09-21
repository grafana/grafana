package object

import (
	"bytes"
	"fmt"
	"sort"
	"strconv"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/searchV2/dslookup"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
)

func NewDashboardObjectReader(lookup dslookup.DatasourceLookup) models.ObjectReader {
	return func(obj models.RawObject) (models.ObjectSummary, error) {
		summary := models.ObjectSummary{
			Labels: make(map[string]string),
			Fields: make(map[string]interface{}),
		}
		stream := bytes.NewBuffer(obj.Body)
		dash, err := extract.ReadDashboard(stream, lookup)
		if err != nil {
			summary.Error = err.Error()
			return summary, err
		}

		refs := newReferenceAccumulator()
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
			refP := newReferenceAccumulator()
			p := models.NestedObjectSummary{
				UID:  obj.UID + "#" + strconv.FormatInt(panel.ID, 10),
				Kind: "panel",
			}
			p.Name = panel.Title
			p.Description = panel.Description
			p.URL = fmt.Sprintf("%s?viewPanel=%d", url, panel.ID)
			p.Fields = make(map[string]interface{}, 0)

			refP.add("panel", panel.Type, "")
			for _, v := range panel.Datasource {
				refs.add("ds", v.Type, v.UID) // dashboard refs
				refP.add("ds", v.Type, v.UID) // panel refs
			}

			for _, v := range panel.Transformer {
				refP.add("transformer", v, "")
			}

			refs.add("panel", panel.Type, "")
			p.References = refP.get()
			summary.Nested = append(summary.Nested, p)
		}

		summary.References = refs.get()
		return summary, nil
	}
}

type referenceAccumulator struct {
	refs map[string]models.ExternalReference
}

func newReferenceAccumulator() referenceAccumulator {
	return referenceAccumulator{
		refs: make(map[string]models.ExternalReference),
	}
}

func (x *referenceAccumulator) add(kind string, sub string, uid string) {
	key := fmt.Sprintf("%s/%s/%s", kind, sub, uid)
	_, ok := x.refs[key]
	if !ok {
		x.refs[key] = models.ExternalReference{
			Kind: kind,
			Type: sub,
			UID:  uid,
		}
	}
}

func (x *referenceAccumulator) get() []models.ExternalReference {
	keys := make([]string, 0, len(x.refs))
	for k := range x.refs {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	refs := make([]models.ExternalReference, len(keys))
	for i, key := range keys {
		refs[i] = x.refs[key]
	}
	return refs
}
