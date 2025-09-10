package writer

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type FakeWriter struct {
	WriteFunc func(ctx context.Context, dsUID string, name string, t time.Time, frames data.Frames, orgID int64, extraLabels map[string]string) error
}

func (w FakeWriter) WriteDatasource(ctx context.Context, dsUID string, name string, t time.Time, frames data.Frames, orgID int64, extraLabels map[string]string) error {
	if w.WriteFunc == nil {
		return nil
	}
	return w.WriteFunc(ctx, dsUID, name, t, frames, orgID, extraLabels)
}
