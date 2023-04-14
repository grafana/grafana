package jsonobj

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/entity"
)

func GetEntityKindInfo() entity.EntityKindInfo {
	return entity.EntityKindInfo{
		ID:          entity.StandardKindJSONObj,
		Name:        "JSON Object",
		Description: "JSON Object",
	}
}

func GetEntitySummaryBuilder() entity.EntitySummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*entity.EntitySummary, []byte, error) {
		v := make(map[string]interface{})
		err := json.Unmarshal(body, &v)
		if err != nil {
			return nil, nil, err
		}

		out, err := json.MarshalIndent(v, "", "  ")
		if err != nil {
			return nil, nil, err
		}
		return &entity.EntitySummary{
			Kind: entity.StandardKindJSONObj,
			Name: store.GuessNameFromUID(uid),
			UID:  uid,
		}, out, err
	}
}
