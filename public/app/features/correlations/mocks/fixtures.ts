import { Correlation, CorrelationSpec } from '@grafana/api-clients/rtkq/correlations/v0alpha1';

export const setupMockCorrelations = () => {
  mockCorrelationsMap.clear();
};

const generateCorrMetadata = (uid: string, correlation: CorrelationSpec) => {
  let labels: Record<string, string> = {
    'correlations.grafana.app/sourceDS-ref': `${correlation.source.group}.${correlation.source.name}`,
  };

  if (correlation.target?.group !== undefined && correlation.target?.name !== undefined) {
    labels['correlations.grafana.app/targetDS-ref'] = `${correlation.target?.group}.${correlation.target?.name}`;
  }

  return {
    kind: 'Correlation',
    apiVersion: 'correlations.grafana.app/v0alpha1',
    metadata: {
      uid: uid,
      name: uid,
      namespace: 'default',
      labels: labels,
    },
    spec: correlation,
  };
};

const fakeCorrelations: CorrelationSpec[] = [
  {
    source: { group: 'loki', name: 'lokiUID' },
    target: { group: 'loki', name: 'lokiUID' },
    label: 'Loki to Loki',
    type: 'query',
    config: {
      field: 'line',
      target: {},
      transformations: [{ type: 'regex', expression: 'url=http[s]?://(S*)', mapValue: 'path' }],
    },
  },
  {
    source: { group: 'loki', name: 'lokiUID' },
    target: { group: 'prometheus', name: 'prometheusUID' },
    label: 'Loki to Prometheus',
    type: 'query',
    config: {
      field: 'line',
      target: {},
      transformations: [{ type: 'regex', expression: 'url=http[s]?://(S*)', mapValue: 'path' }],
    },
  },
  {
    source: { group: 'prometheus', name: 'prometheusUID' },
    target: { group: 'loki', name: 'lokiUID' },
    label: 'Prometheus to Loki',
    type: 'query',
    config: { field: 'label', target: {} },
  },
  {
    source: { group: 'prometheus', name: 'prometheusUID' },
    target: { group: 'prometheus', name: 'prometheusUID' },
    label: 'Prometheus to Prometheus',
    type: 'query',
    config: { field: 'label', target: {} },
  },
];

export let mockCorrelationsMap = new Map<string, Correlation>();

export const resetFixtures = () => {
  setupMockCorrelations();
};

export const prePopulateCorrelations = () => {
  mockCorrelationsMap.set('1', generateCorrMetadata('1', fakeCorrelations[0]));
  mockCorrelationsMap.set('2', generateCorrMetadata('2', fakeCorrelations[1]));
  mockCorrelationsMap.set('3', generateCorrMetadata('3', fakeCorrelations[2]));
  mockCorrelationsMap.set('4', generateCorrMetadata('4', fakeCorrelations[3]));
};
