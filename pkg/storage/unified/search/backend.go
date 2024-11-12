package search

import (
	"context"
	"path/filepath"

	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Construct the search options from settings
func NewSearchOptions(cfg *setting.Cfg, tracer tracing.Tracer, reg prometheus.Registerer, p DocumentBuilderProvider) (opts resource.SearchOptions, err error) {
	opts.Backend = newBleveBackend(bleveOptions{
		Root:          filepath.Join(cfg.DataPath, "unified-search", "bleve"),
		FileThreshold: 500, // after 500 items, switch to file based index
		BatchSize:     100,
	}, tracer, reg)

	// Use default when nothing is configured
	if p == nil {
		p = &standardDocumentProvider{}
	}

	opts.Resources, err = p.GetDocumentBuilders(context.Background())
	return opts, err
}
