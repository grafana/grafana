import { type DataSourceInstanceSettings } from '@grafana/data';

import { getRulesSourceName, isCloudRulesSource, isGrafanaRulesSource } from './rulesSource';

jest.mock('./datasource', () => {
  throw new Error('Rule-source helpers must not initialize datasource services.');
});

const prometheus = {
  uid: 'prometheus-uid',
  name: 'Prometheus',
  type: 'prometheus',
} as DataSourceInstanceSettings;

describe('getRulesSourceName', () => {
  it('returns the built-in Grafana source name', () => {
    expect(getRulesSourceName('grafana')).toBe('grafana');
  });

  it('returns the external datasource name, not its UID or type', () => {
    expect(getRulesSourceName(prometheus)).toBe('Prometheus');
  });
});

describe('rule-source predicates', () => {
  it.each([
    { description: 'the built-in source', source: 'grafana', grafana: true, cloud: false },
    { description: 'an external datasource', source: prometheus, grafana: false, cloud: true },
    {
      description: 'an external datasource named grafana',
      source: { ...prometheus, name: 'grafana' },
      grafana: false,
      cloud: true,
    },
    { description: 'an external source name', source: 'mimir', grafana: false, cloud: true },
    { description: 'an empty source name', source: '', grafana: false, cloud: true },
  ])('classifies $description', ({ source, grafana, cloud }) => {
    expect(isGrafanaRulesSource(source)).toBe(grafana);
    expect(isCloudRulesSource(source)).toBe(cloud);
  });
});
