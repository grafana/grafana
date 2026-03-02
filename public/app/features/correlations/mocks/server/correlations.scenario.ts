import { CorrelationSpec } from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { createCorrelationsHandler, getCorrelationsHandler } from '@grafana/test-utils/unstable';

const generateCorrMetadata = (correlation: CorrelationSpec) => {
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
      name: Math.floor(Math.random() * 1000).toString(),
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

export const emptyCorrelationsScenario = [
  getCorrelationsHandler({
    kind: 'CorrelationList',
    apiVersion: 'correlations.grafana.app/v0alpha1',
    metadata: {},
    items: [],
  }),
];

export const existingCorrelationsScenario = [
  getCorrelationsHandler({
    kind: 'CorrelationList',
    apiVersion: 'correlations.grafana.app/v0alpha1',
    metadata: {},
    items: fakeCorrelations.map((rc) => generateCorrMetadata(rc)),
  }),
];

export const createCorrelationsScenario = [createCorrelationsHandler(generateCorrMetadata(fakeCorrelations[0]))];
