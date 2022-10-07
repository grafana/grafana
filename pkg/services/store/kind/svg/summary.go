package svg

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

// This is just a fake builder for now
func GetObjectSummaryBuilder() models.ObjectSummaryBuilder {
	return func(ctx context.Context, uid string, body []byte) (*models.ObjectSummary, []byte, error) {
		return nil, nil, fmt.Errorf("not implemented yet")
	}
}
