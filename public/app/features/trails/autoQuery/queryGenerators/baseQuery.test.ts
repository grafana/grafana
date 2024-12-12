import { generateBaseQuery } from './baseQuery';

describe('generateBaseQuery', () => {
  it('should return base query without rate and groupings', () => {
    const result = generateBaseQuery({});
    expect(result).toBe('${metric}{${filters}} ${otel_join_query}');
  });

  it('should return rate base query without groupings', () => {
    const result = generateBaseQuery({ isRateQuery: true });
    expect(result).toBe('rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query}');
  });

  it('should return base query with groupings', () => {
    const result = generateBaseQuery({ groupings: ['job', 'instance'] });
    expect(result).toBe('sum by(job, instance) (${metric}{${filters}} ${otel_join_query})');
  });

  it('should return rate base query with groupings', () => {
    const result = generateBaseQuery({ isRateQuery: true, groupings: ['job', 'instance'] });
    expect(result).toBe('sum by(job, instance) (rate(${metric}{${filters}}[$__rate_interval]) ${otel_join_query})');
  });

  it('should return UTF-8 base query without rate and groupings', () => {
    const result = generateBaseQuery({ isUtf8Metric: true });
    expect(result).toBe('{"${metric}", ${filters}} ${otel_join_query}');
  });

  it('should return UTF-8 rate base query without groupings', () => {
    const result = generateBaseQuery({ isRateQuery: true, isUtf8Metric: true });
    expect(result).toBe('rate({"${metric}", ${filters}}[$__rate_interval]) ${otel_join_query}');
  });

  it('should return UTF-8 base query with groupings', () => {
    const result = generateBaseQuery({ isUtf8Metric: true, groupings: ['job', 'instance'] });
    expect(result).toBe('sum by(job, instance) ({"${metric}", ${filters}} ${otel_join_query})');
  });

  it('should return UTF-8 rate base query with groupings', () => {
    const result = generateBaseQuery({ isRateQuery: true, isUtf8Metric: true, groupings: ['job', 'instance'] });
    expect(result).toBe('sum by(job, instance) (rate({"${metric}", ${filters}}[$__rate_interval]) ${otel_join_query})');
  });
});
