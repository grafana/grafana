package dummy

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

func GetObjectKindInfo(kind string) models.ObjectKindInfo {
	return models.ObjectKindInfo{
		ID:          kind,
		Name:        kind,
		Description: "Dummy kind used for testing.",
		IsRaw:       true,
	}
}

func GetObjectSummaryBuilder(kind string) models.ObjectSummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.ObjectSummary, []byte, error) {
		summary := &models.ObjectSummary{
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
			References: []*models.ObjectExternalReference{
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
