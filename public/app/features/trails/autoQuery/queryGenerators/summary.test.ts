import { AutoQueryContext } from '../types';

import { createSummaryMetricQueryDefs } from './summary';

describe('createSummaryMetricQueryDefs', () => {
  it('should generate correct AutoQueryInfo with rate query and UTF-8 metric', () => {
    const context: AutoQueryContext = {
      metricParts: ['http.requests', 'sum'],
      isUtf8Metric: true,
      unit: 'ms',
      suffix: 'sum',
    };

    const result = createSummaryMetricQueryDefs(context);

    expect(result.preview.title).toBe('${metric}');
    expect(result.main.title).toBe('http.requests (average)');
    expect(result.breakdown.title).toBe('${metric}');
    expect(result.preview.queries[0].expr).toBe(
      'sum(rate({"http.requests_sum", ${filters}}[$__rate_interval]) ${otel_join_query})/sum(rate({"http.requests_count", ${filters}}[$__rate_interval]) ${otel_join_query})'
    );
    expect(result.breakdown.queries[0].expr).toBe(
      'sum(rate({"http.requests_sum", ${filters}}[$__rate_interval]) ${otel_join_query})by(${groupby})/sum(rate({"http.requests_count", ${filters}}[$__rate_interval]) ${otel_join_query})by(${groupby})'
    );
    expect(result.preview.unit).toBe('ms');
  });

  it('should generate correct AutoQueryInfo without UTF-8 metric', () => {
    const context: AutoQueryContext = {
      metricParts: ['cpu', 'usage', 'seconds', 'sum'],
      isUtf8Metric: false,
      unit: 's',
      suffix: 'sum',
    };

    const result = createSummaryMetricQueryDefs(context);

    expect(result.preview.title).toBe('${metric}');
    expect(result.main.title).toBe('cpu_usage_seconds (average)');
    expect(result.breakdown.title).toBe('${metric}');
    expect(result.preview.queries[0].expr).toBe(
      'sum(rate(cpu_usage_seconds_sum{${filters}}[$__rate_interval]) ${otel_join_query})/sum(rate(cpu_usage_seconds_count{${filters}}[$__rate_interval]) ${otel_join_query})'
    );
    expect(result.breakdown.queries[0].expr).toBe(
      'sum(rate(cpu_usage_seconds_sum{${filters}}[$__rate_interval]) ${otel_join_query})by(${groupby})/sum(rate(cpu_usage_seconds_count{${filters}}[$__rate_interval]) ${otel_join_query})by(${groupby})'
    );
    expect(result.preview.unit).toBe('s');
  });
});
