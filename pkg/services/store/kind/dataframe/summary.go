package dataframe

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/store"
)

func GetEntityKindInfo() models.EntityKindInfo {
	return models.EntityKindInfo{
		ID:          models.StandardKindDataFrame,
		Name:        "Data frame",
		Description: "Data frame",
	}
}

func GetEntitySummaryBuilder() models.EntitySummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.EntitySummary, []byte, error) {
		df := &data.Frame{}
		err := json.Unmarshal(body, df)
		if err != nil {
			return nil, nil, err
		}
		rows, err := df.RowLen()
		if err != nil {
			return nil, nil, err
		}

		out, err := data.FrameToJSON(df, data.IncludeAll)
		if err != nil {
			return nil, nil, err
		}
		summary := &models.EntitySummary{
			Kind: models.StandardKindDataFrame,
			Name: df.Name,
			UID:  uid,
			Fields: map[string]interface{}{
				"rows": rows,
				"cols": len(df.Fields),
			},
		}
		if summary.Name == "" {
			summary.Name = store.GuessNameFromUID(uid)
		}
		return summary, out, err
	}
}
