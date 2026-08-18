import { matchPluginId } from '@grafana/data';

import { isPrometheusType } from './prometheus';

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

// Explore checks the pane datasource with `matchPluginId` and full plugin meta, and each
// Mixed query with `isPrometheusType` and a bare type. These pin that the two agree.
describe('agreement with matchPluginId', () => {
  it.each(['prometheus', 'grafana-amazonprometheus-datasource', 'loki'])(
    'gives the same answer for %s as full plugin meta does',
    (id) => {
      expect(isPrometheusType(id)).toBe(matchPluginId('prometheus', { id }));
    }
  );

  it('ignores aliasIDs, which is why a bare type id is a safe substitute for plugin meta', () => {
    expect(matchPluginId('prometheus', { id: 'some-datasource', aliasIDs: ['prometheus'] })).toBe(false);
  });
});
