import { type CorrelationSpec } from '@grafana/api-clients/rtkq/correlations/v0alpha1';

import { fakeCorrelations, generateCorrMetadata } from './fixtures';
import {
  createCorrelationsHandler,
  deleteCorrelationsHandler,
  editCorrelationsHandler,
  getCorrelationsHandler,
} from './handlers';

export const emptyCorrelationsScenario = [
  getCorrelationsHandler({
    kind: 'CorrelationList',
    apiVersion: 'correlations.grafana.app/v0alpha1',
    metadata: {},
    items: [],
  }),
];

const newCorrelation: CorrelationSpec = {
  source: { group: 'loki', name: 'lokiUID' },
  target: { group: 'loki', name: 'lokiUID' },
  label: 'New Correlation',
  type: 'query',
  config: {
    field: 'line',
    target: {},
    transformations: [{ type: 'regex', expression: 'url=http[s]?://(S*)', mapValue: 'path' }],
  },
};

export const createCorrelationsScenario = [createCorrelationsHandler(generateCorrMetadata('0', newCorrelation))];

export const deleteCorrelationsScenario = [
  deleteCorrelationsHandler({
    kind: 'CorrelationList',
    apiVersion: 'correlations.grafana.app/v0alpha1',
    metadata: {},
    status: '200',
    message: 'success',
  }),
];

const editedCorr = { ...fakeCorrelations[0] };
editedCorr.label = 'edited label';

export const editCorrelationsScenario = [editCorrelationsHandler(generateCorrMetadata('0', editedCorr))];
