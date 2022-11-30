package jsonobj

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/store"
)

func GetObjectKindInfo() models.ObjectKindInfo {
	return models.ObjectKindInfo{
		ID:          models.StandardKindJSONObj,
		Name:        "JSON Object",
		Description: "JSON Object",
	}
}

func GetObjectSummaryBuilder() models.ObjectSummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.ObjectSummary, []byte, error) {
		v := make(map[string]interface{})
		err := json.Unmarshal(body, &v)
		if err != nil {
			return nil, nil, err
		}

		out, err := json.MarshalIndent(v, "", "  ")
		if err != nil {
			return nil, nil, err
		}
		return &models.ObjectSummary{
			Kind: models.StandardKindJSONObj,
			Name: store.GuessNameFromUID(uid),
			UID:  uid,
		}, out, err
	}
}
