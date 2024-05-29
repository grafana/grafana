package writer

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Writer interface {
	Write(ctx context.Context, name string, t time.Time, frames data.Frames, extraLabels map[string]string) error
}
