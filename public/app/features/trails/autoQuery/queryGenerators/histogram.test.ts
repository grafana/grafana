import { AutoQueryContext } from '../types';

import { createHistogramMetricQueryDefs } from './histogram';

describe('createHistogramMetricQueryDefs utf8=false', () => {
  const ctx: AutoQueryContext = {
    metricParts: ['test', 'latency', 'seconds', 'bucket'],
    isUtf8Metric: false,
    suffix: 'bucket',
    unitSuffix: 'seconds',
    unit: 's',
  };

  it('should create the correct title and unit for metricParts', () => {
    const result = createHistogramMetricQueryDefs(ctx);
    expect(result.preview.title).toBe('${metric}');
    expect(result.preview.unit).toBe('s');
  });

  it('should generate correct p50 AutoQueryDef', () => {
    const result = createHistogramMetricQueryDefs(ctx);
    const p50Query = result.breakdown.queries[0];

    expect(p50Query.expr).toBe(
      'histogram_quantile(0.5, sum by(le, ${groupby}) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))'
    );
    expect(p50Query.legendFormat).toBe('{{${groupby}}}');
  });

  it('should generate correct percentiles AutoQueryDef', () => {
    const result = createHistogramMetricQueryDefs(ctx);
    const percentileQueries = result.variants[0].queries;

    expect(percentileQueries[0].expr).toBe(
      'histogram_quantile(0.99, sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))'
    );
    expect(percentileQueries[1].expr).toBe(
      'histogram_quantile(0.9, sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))'
    );
    expect(percentileQueries[2].expr).toBe(
      'histogram_quantile(0.5, sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}))'
    );
  });

  it('should generate correct heatmap AutoQueryDef', () => {
    const result = createHistogramMetricQueryDefs(ctx);
    const heatmapQuery = result.preview.queries[0];

    expect(heatmapQuery.expr).toBe('sum by(le) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query})');
    expect(result.preview.variant).toBe('heatmap');
  });
});

describe('createHistogramMetricQueryDefs utf8=true', () => {
  const ctx: AutoQueryContext = {
    metricParts: ['test', 'latency', 'seconds', 'bucket'],
    isUtf8Metric: true,
    suffix: 'bucket',
    unitSuffix: 'seconds',
    unit: 's',
  };

  it('should create the correct title and unit for metricParts', () => {
    const result = createHistogramMetricQueryDefs(ctx);
    expect(result.preview.title).toBe('${metric}');
    expect(result.preview.unit).toBe('s');
  });

  it('should generate correct p50 AutoQueryDef', () => {
    const result = createHistogramMetricQueryDefs(ctx);
    const p50Query = result.breakdown.queries[0];

    expect(p50Query.expr).toBe(
      'histogram_quantile(0.5, sum by(le, ${groupby}) (rate({"${metric}", ${filters}}[$__rate_interval]) ${otel_join_query}))'
    );
    expect(p50Query.legendFormat).toBe('{{${groupby}}}');
  });

  it('should generate correct percentiles AutoQueryDef', () => {
    const result = createHistogramMetricQueryDefs(ctx);
    const percentileQueries = result.variants[0].queries;

    expect(percentileQueries[0].expr).toBe(
      'histogram_quantile(0.99, sum by(le) (rate({"${metric}", ${filters}}[$__rate_interval]) ${otel_join_query}))'
    );
    expect(percentileQueries[1].expr).toBe(
      'histogram_quantile(0.9, sum by(le) (rate({"${metric}", ${filters}}[$__rate_interval]) ${otel_join_query}))'
    );
    expect(percentileQueries[2].expr).toBe(
      'histogram_quantile(0.5, sum by(le) (rate({"${metric}", ${filters}}[$__rate_interval]) ${otel_join_query}))'
    );
  });

  it('should generate correct heatmap AutoQueryDef', () => {
    const result = createHistogramMetricQueryDefs(ctx);
    const heatmapQuery = result.preview.queries[0];

    expect(heatmapQuery.expr).toBe('sum by(le) (rate({"${metric}", ${filters}}[$__rate_interval]) ${otel_join_query})');
    expect(result.preview.variant).toBe('heatmap');
  });
});
