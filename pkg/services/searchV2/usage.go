package searchV2

import (
	"context"
	"fmt"

	"github.com/blugelabs/bluge"
	"github.com/blugelabs/bluge/search"
	"github.com/blugelabs/bluge/search/aggregations"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type usageGauge struct {
	field string
	gauge *prometheus.GaugeVec
}

var (
	infoPanelUsage = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "panel_type_usage_info",
		Help:      "info metric that exposes how often each panel type is used",
		Namespace: "grafana",
	}, []string{"name", "orgId"})

	infoDatasourceUsage = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "datasource_usage_info",
		Help:      "info metric that exposes how often each datasource type is used",
		Namespace: "grafana",
	}, []string{"name", "orgId"})

	infoTransformerUsage = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "transformer_usage_info",
		Help:      "info metric that exposes how often each transformer type is used",
		Namespace: "grafana",
	}, []string{"name", "orgId"})

	panelUsage = []usageGauge{
		{field: documentFieldDSType, gauge: infoDatasourceUsage},
		{field: documentFieldPanelType, gauge: infoPanelUsage},
		{field: documentFieldTransformer, gauge: infoTransformerUsage},
	}
)

func updateUsageStats(ctx context.Context, reader *bluge.Reader, orgId int64, logger log.Logger) {
	org := fmt.Sprintf("%d", orgId)

	req := bluge.NewAllMatches(bluge.NewTermQuery("panel").SetField(documentFieldKind))
	for _, usage := range panelUsage {
		req.AddAggregation(usage.field, aggregations.NewTermsAggregation(search.Field(usage.field), 50))
	}

	// execute this search on the reader
	documentMatchIterator, err := reader.Search(ctx, req)
	if err != nil {
		logger.Error("error executing search: %v", err)
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
			usage.gauge.WithLabelValues(v.Name(), org).Set(float64(v.Count()))
		}
	}
}
