package testdatasource

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// ConvertObject implements backend.ConversionHandler.
func (s *Service) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	return nil, fmt.Errorf("not implemented")
}
