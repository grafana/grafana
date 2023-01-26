package dummy

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/store/entity"
)

func GetEntityKindInfo(kind string) entity.EntityKindInfo {
	return entity.EntityKindInfo{
		ID:          kind,
		Name:        kind,
		Description: "Dummy kind used for testing.",
		IsRaw:       true,
	}
}

func GetEntitySummaryBuilder(kind string) entity.EntitySummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*entity.EntitySummary, []byte, error) {
		summary := &entity.EntitySummary{
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
			References: []*entity.EntityExternalReference{
				{
					Family:     "ds",
					Type:       "influx",
					Identifier: "xyz",
				},
				{
					Family: entity.StandardKindPanel,
					Type:   "heatmap",
				},
				{
					Family: entity.StandardKindPanel,
					Type:   "timeseries",
				},
			},
		}

		if summary.UID != "" && uid != summary.UID {
			return summary, nil, fmt.Errorf("internal UID mismatch")
		}

		return summary, body, nil
	}
}
