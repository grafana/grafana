import { obfuscate } from './tracking';

describe('obfuscate', () => {
  it('obfuscates metric name', () => {
    expect(obfuscate('http_requests_total')).toEqual('Identifier');
  });

  it('obfuscates metric name with labels', () => {
    expect(obfuscate('http_requests_total{job="grafana"}')).toEqual('Identifier{Identifier=StringLiteral}');
  });

  it('obfuscates on valid query with rate', () => {
    expect(obfuscate('rate(http_requests_total{job="grafana"}[5m])')).toEqual(
      'rate(Identifier{Identifier=StringLiteral}[NumberDurationLiteral])'
    );
  });

  it('obfuscates aggregation query', () => {
    expect(obfuscate('sum(rate(http_requests_total{job="grafana"}[5m])) by (instance)')).toEqual(
      'sum(rate(Identifier{Identifier=StringLiteral}[NumberDurationLiteral])) by (Identifier)'
    );
  });

  it('obfuscates arithmetic operations', () => {
    expect(obfuscate('2 + 3')).toEqual('NumberDurationLiteral + NumberDurationLiteral');
  });

  it('obfuscates binary operations with metrics', () => {
    expect(obfuscate('http_requests_total / http_requests_failed')).toEqual('Identifier / Identifier');
  });

  it('obfuscates query with multiple labels', () => {
    expect(obfuscate('up{job="prometheus", instance="localhost:9090"}')).toEqual(
      'Identifier{Identifier=StringLiteral, Identifier=StringLiteral}'
    );
  });

  it('does not obfuscate __name__ label', () => {
    expect(obfuscate('{__name__="http_requests_total"}')).toEqual('{__name__=StringLiteral}');
  });

  it('does not obfuscate interval variables', () => {
    expect(obfuscate('rate(http_requests_total[$__interval])')).toEqual('rate(Identifier[$__interval])');
  });

  it('does not obfuscate rate_interval variable', () => {
    expect(obfuscate('rate(http_requests_total[$__rate_interval])')).toEqual('rate(Identifier[$__rate_interval])');
  });

  it('does not obfuscate range variables', () => {
    expect(obfuscate('rate(http_requests_total[$__range])')).toEqual('rate(Identifier[$__range])');
    expect(obfuscate('rate(http_requests_total[$__range_s])')).toEqual('rate(Identifier[$__range_s])');
    expect(obfuscate('rate(http_requests_total[$__range_ms])')).toEqual('rate(Identifier[$__range_ms])');
  });

  it('obfuscates complex query with histogram_quantile', () => {
    expect(
      obfuscate('histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="api"}[5m])) by (le))')
    ).toEqual(
      'histogram_quantile(NumberDurationLiteral, sum(rate(Identifier{Identifier=StringLiteral}[NumberDurationLiteral])) by (Identifier))'
    );
  });

  it('obfuscates offset modifier', () => {
    expect(obfuscate('http_requests_total offset 5m')).toEqual('Identifier offset NumberDurationLiteral');
  });

  it('handles empty query', () => {
    expect(obfuscate('')).toEqual('');
  });
});
