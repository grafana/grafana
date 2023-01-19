package dummy

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

func GetEntityKindInfo(kind string) models.EntityKindInfo {
	return models.EntityKindInfo{
		ID:          kind,
		Name:        kind,
		Description: "Dummy kind used for testing.",
		IsRaw:       true,
	}
}

func GetEntitySummaryBuilder(kind string) models.EntitySummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.EntitySummary, []byte, error) {
		summary := &models.EntitySummary{
			Name:        fmt.Sprintf("Dummy: %s", kind),
			Kind:        kind,
			Description: fmt.Sprintf("Wrote at %s", time.Now().Local().String()),
			Labels: map[string]string{
				"hello": "world",
				"tag1":  "",
				"tag2":  "",
			},
			Fields: map[string]interface{}{
				"field1": "a string",
				"field2": 1.224,
				"field4": true,
			},
			Error:  nil, // ignore for now
			Nested: nil, // ignore for now
			References: []*models.EntityExternalReference{
				{
					Kind: "ds",
					Type: "influx",
					UID:  "xyz",
				},
				{
					Kind: "panel",
					Type: "heatmap",
				},
				{
					Kind: "panel",
					Type: "timeseries",
				},
			},
		}

		if summary.UID != "" && uid != summary.UID {
			return summary, nil, fmt.Errorf("internal UID mismatch")
		}

		return summary, body, nil
	}
}
