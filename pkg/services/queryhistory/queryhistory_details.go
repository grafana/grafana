package queryhistory

import (
	"encoding/json"
	"slices"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type DataQuery struct {
	Datasource Datasource `json:"datasource"`
}

func FindDataSourceUIDs(queriesJSON *simplejson.Json) ([]string, error) {
	uids := make([]string, 0)
	queries := []DataQuery{}
	bytes, err := queriesJSON.ToDB()

	if err != nil {
		return uids, err
	}

	err = json.Unmarshal(bytes, &queries)

	if err != nil {
		return uids, err
	}

	for _, query := range queries {
		if !slices.Contains(uids, query.Datasource.UID) {
			uids = append(uids, query.Datasource.UID)
		}
	}

	return uids, nil
}
