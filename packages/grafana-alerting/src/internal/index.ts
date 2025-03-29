import * as PrometheusAPI from '../types/prometheus/rules/api.mocks';
import * as PrometheusDefinition from '../types/prometheus/rules/definitions.mocks';

/**
 * These annotations have special meaning / reserved usage in Grafana.
 */
export type ReservedAnnotation =
  | 'description'
  | 'summary'
  | 'runbook_url'
  | '__alertId__'
  | '__dashboardUid__'
  | '__panelId__';

/**
 * Mocks are currently internal to prevent changes to the mocks to propagate to 3rd party consumers.
 */
export const mocks = {
  prometheus: {
    api: PrometheusAPI,
    definitions: PrometheusDefinition,
  },
  grafana: {},
};
