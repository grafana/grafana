package searchV2

import (
	"context"

	"github.com/blugelabs/bluge"
	"github.com/blugelabs/bluge/search"
	"github.com/blugelabs/bluge/search/aggregations"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

type usageGauge struct {
	field string
	gauge *prometheus.GaugeVec
}

var (
	infoPanelUsage = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "panel_type_usage",
		Help:      "a metric indicating how many panels across all dashboards use each plugin panel type",
		Namespace: "grafana",
	}, []string{"name"})

	infoDatasourceUsage = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "panel_datasource_usage",
		Help:      "indicates how many panels across all dashboards reference each datasource type",
		Namespace: "grafana",
	}, []string{"name"})

	infoTransformerUsage = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "panel_transformer_usage",
		Help:      "indicates how many panels use each transformer type",
		Namespace: "grafana",
	}, []string{"name"})

	panelUsage = []usageGauge{
		{field: documentFieldDSType, gauge: infoDatasourceUsage},
		{field: documentFieldPanelType, gauge: infoPanelUsage},
		{field: documentFieldTransformer, gauge: infoTransformerUsage},
	}
)

func updateUsageStats(ctx context.Context, reader *bluge.Reader, logger log.Logger, tracer tracing.Tracer) {
	ctx, span := tracer.Start(ctx, "searchV2 updateUsageStats")
	defer span.End()
	req := bluge.NewAllMatches(bluge.NewTermQuery("panel").SetField(documentFieldKind))
	for _, usage := range panelUsage {
		req.AddAggregation(usage.field, aggregations.NewTermsAggregation(search.Field(usage.field), 50))
	}

	// execute this search on the reader
	documentMatchIterator, err := reader.Search(ctx, req)
	if err != nil {
		logger.Error("error executing search", "err", err)
		return
	}

	// need to iterate through the document matches, otherwise the aggregations are empty?
	match, err := documentMatchIterator.Next()
	for err == nil && match != nil {
		match, err = documentMatchIterator.Next()
	}

	aggs := documentMatchIterator.Aggregations()
	for _, usage := range panelUsage {
		bucket := aggs.Buckets(usage.field)
		for _, v := range bucket {
			if v.Name() == "" {
				continue
			}
			usage.gauge.WithLabelValues(v.Name()).Set(float64(v.Count()))
		}
	}
}
