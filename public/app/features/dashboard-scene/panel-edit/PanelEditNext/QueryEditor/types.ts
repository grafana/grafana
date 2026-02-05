import { DataTransformerConfig, TransformerRegistryItem } from '@grafana/data';

export type Transformation = {
  registryItem: TransformerRegistryItem | undefined;
  transformId: string;
  transformConfig: DataTransformerConfig;
};

export const QueryOptionFields = {
  maxDataPoints: 'maxDataPoints',
  minInterval: 'minInterval',
  interval: 'interval',
  relativeTime: 'relativeTime',
  timeShift: 'timeShift',
  cacheTimeout: 'cacheTimeout',
  cacheTTL: 'cacheTTL',
  queryCachingTTL: 'queryCachingTTL',
} as const;

export type QueryOptionField = (typeof QueryOptionFields)[keyof typeof QueryOptionFields];
