import { HttpResponse, http } from 'msw';

import { LabelItem, LabelKeyAndValues } from 'app/features/alerting/unified/api/labelsApi';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

const BASE_URL = `/api/plugins/${SupportedPlugin.Labels}/resources`;

// Default mock data for ops labels
const defaultLabelKeys: LabelItem[] = [
  { id: '1', name: 'sentMail', prescribed: false },
  { id: '2', name: 'stage', prescribed: false },
  { id: '3', name: 'team', prescribed: false },
];

const defaultLabelValues: Record<string, LabelItem[]> = {
  sentMail: [
    { id: '1', name: 'true', prescribed: false },
    { id: '2', name: 'false', prescribed: false },
  ],
  stage: [
    { id: '1', name: 'production', prescribed: false },
    { id: '2', name: 'staging', prescribed: false },
    { id: '3', name: 'development', prescribed: false },
  ],
  team: [
    { id: '1', name: 'frontend', prescribed: false },
    { id: '2', name: 'backend', prescribed: false },
    { id: '3', name: 'platform', prescribed: false },
  ],
};

/**
 * Handler for GET /api/plugins/grafana-labels-app/resources/v1/labels/keys
 * Returns all available label keys
 */
export const getLabelsKeysHandler = (labelKeys: LabelItem[] = defaultLabelKeys) =>
  http.get(`${BASE_URL}/v1/labels/keys`, () => {
    return HttpResponse.json(labelKeys);
  });

/**
 * Handler for GET /api/plugins/grafana-labels-app/resources/v1/labels/name/:key
 * Returns values for a specific label key
 */
export const getLabelValuesHandler = (labelValues: Record<string, LabelItem[]> = defaultLabelValues) =>
  http.get<{ key: string }>(`${BASE_URL}/v1/labels/name/:key`, ({ params }) => {
    const key = params.key;
    const values = labelValues[key] || [];
    const response: LabelKeyAndValues = {
      labelKey: { id: '1', name: key, prescribed: false },
      values,
    };
    return HttpResponse.json(response);
  });

const handlers = [getLabelsKeysHandler(), getLabelValuesHandler()];
export default handlers;
