import { AlertState, DataTransformerConfig, TransformerRegistryItem } from '@grafana/data';
import { CombinedRule } from 'app/types/unified-alerting';

export type Transformation = {
  registryItem: TransformerRegistryItem | undefined;
  transformId: string;
  transformConfig: DataTransformerConfig;
};

export type AlertRule = {
  alertId: string;
  rule: CombinedRule;
  state: AlertState | null;
};

/**
 * Empty alert used to show the alerts view when no actual alerts exist.
 * Allows users to access the empty state and "New alert rule" button.
 */
export const EMPTY_ALERT: AlertRule = {
  alertId: '__EMPTY_ALERT_VIEW__',
  state: null,
  rule: {
    name: '',
    query: '',
    labels: {},
    annotations: {},
    group: {
      name: '',
      rules: [],
      totals: {},
    },
    namespace: {
      rulesSource: 'grafana',
      name: '',
      groups: [],
    },
    instanceTotals: {},
    filteredInstanceTotals: {},
  },
};

export enum QueryOptionField {
  maxDataPoints = 'maxDataPoints',
  minInterval = 'minInterval',
  interval = 'interval',
  relativeTime = 'relativeTime',
  timeShift = 'timeShift',
  cacheTimeout = 'cacheTimeout',
  queryCachingTTL = 'queryCachingTTL',
}
