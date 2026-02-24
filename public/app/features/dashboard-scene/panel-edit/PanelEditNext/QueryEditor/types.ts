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
  state: AlertState;
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
