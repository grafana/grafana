package pipeline

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Converter interface {
	Convert(ctx context.Context, vars Vars, body []byte) ([]*data.Frame, error)
}
