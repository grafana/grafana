package eval

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type FakeLoadedMetricsReader struct {
	fingerprints map[data.Fingerprint]struct{}
}

func (f FakeLoadedMetricsReader) Read(_ context.Context) map[data.Fingerprint]struct{} {
	return f.fingerprints
}
