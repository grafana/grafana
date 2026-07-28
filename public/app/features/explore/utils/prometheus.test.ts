import { isPrometheusPlugin, isPrometheusType } from './prometheus';

describe('isPrometheusType', () => {
  it.each(['prometheus', 'grafana-amazonprometheus-datasource', 'grafana-azureprometheus-datasource'])(
    'treats %s as Prometheus',
    (type) => {
      expect(isPrometheusType(type)).toBe(true);
    }
  );

  it.each(['loki', 'elasticsearch', 'grafana-testdata-datasource', 'prometheus-something-else'])(
    'treats %s as not Prometheus',
    (type) => {
      expect(isPrometheusType(type)).toBe(false);
    }
  );

  it.each([undefined, null, ''])('returns false for %p', (type) => {
    expect(isPrometheusType(type)).toBe(false);
  });
});

describe('isPrometheusPlugin', () => {
  it.each(['prometheus', 'grafana-amazonprometheus-datasource', 'loki'])(
    'agrees with isPrometheusType for %s, so a type-only query ref and full plugin meta cannot diverge',
    (id) => {
      expect(isPrometheusPlugin({ id })).toBe(isPrometheusType(id));
    }
  );

  it('ignores aliasIDs, which is why a bare type id is a safe substitute for plugin meta', () => {
    expect(isPrometheusPlugin({ id: 'some-datasource', aliasIDs: ['prometheus'] })).toBe(false);
  });
});
