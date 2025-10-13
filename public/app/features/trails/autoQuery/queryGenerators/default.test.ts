import { AutoQueryContext } from '../types';

import { createDefaultMetricQueryDefs } from './default';

describe('createDefaultMetricQueryDefs', () => {
  it('should generate correct AutoQueryInfo for rate query with UTF-8 metric', () => {
    const context: AutoQueryContext = {
      metricParts: ['http.requests', 'total'],
      suffix: 'total',
      isUtf8Metric: true,
      unit: 'cps',
    };

    const result = createDefaultMetricQueryDefs(context);

    expect(result.main.title).toBe('${metric} (overall per-second rate)');
    expect(result.main.queries[0].expr).toBe(
      'sum(rate({"${metric}", ${filters}}[$__rate_interval]) ${otel_join_query})'
    );
    expect(result.breakdown.queries[0].expr).toBe(
      'sum(rate({"${metric}", ${filters}}[$__rate_interval]) ${otel_join_query})by(${groupby})'
    );
    expect(result.preview.unit).toBe('cps');
  });

  it('should generate correct AutoQueryInfo for non-rate query without UTF-8 metric', () => {
    const context: AutoQueryContext = {
      metricParts: ['cpu', 'usage', 'seconds'],
      suffix: 'avg',
      isUtf8Metric: false,
      unit: 's',
    };

    const result = createDefaultMetricQueryDefs(context);

    expect(result.main.title).toBe('${metric} (average)');
    expect(result.main.queries[0].expr).toBe('avg(${metric}{${filters}} ${otel_join_query})');
    expect(result.breakdown.queries[0].expr).toBe('avg(${metric}{${filters}} ${otel_join_query})by(${groupby})');
    expect(result.preview.unit).toBe('short');
  });
});
