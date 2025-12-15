import { HttpResponse, http } from 'msw';

import { LabelItem, LabelKeyAndValues } from 'app/features/alerting/unified/api/labelsApi';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

const BASE_URL = `/api/plugins/${SupportedPlugin.Labels}/resources`;

// Default mock data for ops labels
export const defaultLabelKeys: LabelItem[] = [
  { id: '1', name: 'sentMail', prescribed: false },
  { id: '2', name: 'stage', prescribed: false },
  { id: '3', name: 'team', prescribed: false },
];

export const defaultLabelValues: Record<string, LabelItem[]> = {
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
 * Helper to generate mock ops labels in the form format (key-value pairs).
 * @param keys - Array of label key names to include (defaults to first two: sentMail, stage)
 * @param labelValues - Optional custom label values map
 * @returns Array of { key, value } objects for use in form tests
 */
export function getMockOpsLabels(
  keys: string[] = [defaultLabelKeys[0].name, defaultLabelKeys[1].name],
  labelValues: Record<string, LabelItem[]> = defaultLabelValues
): Array<{ key: string; value: string }> {
  return keys.map((key) => ({
    key,
    value: labelValues[key]?.[0]?.name ?? '',
  }));
}

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
 * Returns values for a specific label key.
 * @param labelValues - Custom label values map (defaults to defaultLabelValues)
 * @param onKeyRequested - Optional callback to spy on which keys are requested (useful for testing)
 */
export const getLabelValuesHandler = (
  labelValues: Record<string, LabelItem[]> = defaultLabelValues,
  onKeyRequested?: (key: string) => void
) =>
  http.get<{ key: string }>(`${BASE_URL}/v1/labels/name/:key`, ({ params }) => {
    const key = params.key;
    onKeyRequested?.(key);
    const values = labelValues[key] || [];
    const response: LabelKeyAndValues = {
      labelKey: { id: '1', name: key, prescribed: false },
      values,
    };
    return HttpResponse.json(response);
  });

const handlers = [getLabelsKeysHandler(), getLabelValuesHandler()];
export default handlers;
