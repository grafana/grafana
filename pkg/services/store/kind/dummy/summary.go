package dummy

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

func GetObjectKindInfo() models.ObjectKindInfo {
	return models.ObjectKindInfo{
		ID:          "dummy",
		Name:        "Dummy",
		Description: "Allows anything and produces a complex summary object",
		IsRaw:       true,
	}
}

func GetObjectSummaryBuilder() models.ObjectSummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.ObjectSummary, []byte, error) {
		summary := &models.ObjectSummary{
			Name:        fmt.Sprintf("hello: %s", "dummy"),
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
