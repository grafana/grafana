package elasticstore

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/raintank/raintank-metric/schema"
)

func init() {
	bus.AddHandler("es", GetEventsQuery)
}

func GetEventsQuery(query *m.GetEventsQuery) error {
	query.Result = make([]*schema.ProbeEvent, 0)
	esQuery := map[string]interface{}{
		"query": map[string]interface{}{
			"filtered": map[string]interface{}{
				"filter": map[string]interface{}{
					"and": []map[string]interface{}{
						{
							"range": map[string]interface{}{
								"timestamp": map[string]interface{}{
									"gte": query.Start,
									"lte": query.End,
								},
							},
						},
						{
							"term": map[string]int64{
								"org_id": query.OrgId,
							},
						},
					},
				},
				"query": map[string]interface{}{
					"query_string": map[string]string{
						"query": query.Query,
					},
				},
			},
		},
	}
	out, err := es.Search("events", "", map[string]interface{}{"size": query.Size, "sort": "timestamp:desc"}, esQuery)
	if err != nil {
		return err
	}
	for _, hit := range out.Hits.Hits {
		var source schema.ProbeEvent
		err = json.Unmarshal(*hit.Source, &source)
		if err != nil {
			return err
		}
		query.Result = append(query.Result, &source)
	}

	return nil
}
