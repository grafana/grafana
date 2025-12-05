package es

const (
	// DefaultGeoHashPrecision is the default precision for geohash grid aggregations
	DefaultGeoHashPrecision = 3
	// termsOrderTerm is used internally for ordering terms
	termsOrderTerm = "_term"
)

// AggBuilder represents an aggregation builder
type AggBuilder interface {
	Histogram(key, field string, fn func(a *HistogramAgg, b AggBuilder)) AggBuilder
	DateHistogram(key, field string, fn func(a *DateHistogramAgg, b AggBuilder)) AggBuilder
	Terms(key, field string, fn func(a *TermsAggregation, b AggBuilder)) AggBuilder
	Nested(key, path string, fn func(a *NestedAggregation, b AggBuilder)) AggBuilder
	Filters(key string, fn func(a *FiltersAggregation, b AggBuilder)) AggBuilder
	GeoHashGrid(key, field string, fn func(a *GeoHashGridAggregation, b AggBuilder)) AggBuilder
	Metric(key, metricType, field string, fn func(a *MetricAggregation)) AggBuilder
	Pipeline(key, pipelineType string, bucketPath any, fn func(a *PipelineAggregation)) AggBuilder
	Build() (AggArray, error)
}

type aggBuilderImpl struct {
	AggBuilder
	aggDefs []*aggDef
}

func newAggBuilder() *aggBuilderImpl {
	return &aggBuilderImpl{
		aggDefs: make([]*aggDef, 0),
	}
}

func (b *aggBuilderImpl) Build() (AggArray, error) {
	aggs := make(AggArray, 0)

	for _, aggDef := range b.aggDefs {
		agg := &Agg{
			Key:         aggDef.key,
			Aggregation: aggDef.aggregation,
		}

		for _, cb := range aggDef.builders {
			childAggs, err := cb.Build()
			if err != nil {
				return nil, err
			}

			agg.Aggregation.Aggs = append(agg.Aggregation.Aggs, childAggs...)
		}

		aggs = append(aggs, agg)
	}

	return aggs, nil
}

func (b *aggBuilderImpl) Histogram(key, field string, fn func(a *HistogramAgg, b AggBuilder)) AggBuilder {
	innerAgg := &HistogramAgg{
		Field: field,
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        "histogram",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder()
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) DateHistogram(key, field string, fn func(a *DateHistogramAgg, b AggBuilder)) AggBuilder {
	innerAgg := &DateHistogramAgg{
		Field: field,
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        "date_histogram",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder()
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Terms(key, field string, fn func(a *TermsAggregation, b AggBuilder)) AggBuilder {
	innerAgg := &TermsAggregation{
		Field: field,
		Order: make(map[string]any),
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        "terms",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder()
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	if len(innerAgg.Order) > 0 {
		if orderBy, exists := innerAgg.Order[termsOrderTerm]; exists {
			innerAgg.Order["_key"] = orderBy
			delete(innerAgg.Order, termsOrderTerm)
		}
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Nested(key, field string, fn func(a *NestedAggregation, b AggBuilder)) AggBuilder {
	innerAgg := &NestedAggregation{
		Path: field,
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        "nested",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder()
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Filters(key string, fn func(a *FiltersAggregation, b AggBuilder)) AggBuilder {
	innerAgg := &FiltersAggregation{
		Filters: make(map[string]any),
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        "filters",
		Aggregation: innerAgg,
	})
	if fn != nil {
		builder := newAggBuilder()
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) GeoHashGrid(key, field string, fn func(a *GeoHashGridAggregation, b AggBuilder)) AggBuilder {
	innerAgg := &GeoHashGridAggregation{
		Field:     field,
		Precision: DefaultGeoHashPrecision,
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        "geohash_grid",
		Aggregation: innerAgg,
	})

	if fn != nil {
		builder := newAggBuilder()
		aggDef.builders = append(aggDef.builders, builder)
		fn(innerAgg, builder)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Metric(key, metricType, field string, fn func(a *MetricAggregation)) AggBuilder {
	innerAgg := &MetricAggregation{
		Type:     metricType,
		Field:    field,
		Settings: make(map[string]any),
	}

	aggDef := newAggDef(key, &aggContainer{
		Type:        metricType,
		Aggregation: innerAgg,
	})

	if fn != nil {
		fn(innerAgg)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}

func (b *aggBuilderImpl) Pipeline(key, pipelineType string, bucketPath any, fn func(a *PipelineAggregation)) AggBuilder {
	innerAgg := &PipelineAggregation{
		BucketPath: bucketPath,
		Settings:   make(map[string]any),
	}
	aggDef := newAggDef(key, &aggContainer{
		Type:        pipelineType,
		Aggregation: innerAgg,
	})

	if fn != nil {
		fn(innerAgg)
	}

	b.aggDefs = append(b.aggDefs, aggDef)

	return b
}
