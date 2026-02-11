import { DataTransformerConfig, TransformerRegistryItem } from '@grafana/data';

export function getTransformId(transformConfigId: string, index: number): string {
  return `${transformConfigId}-${index}`;
}

export type Transformation = {
  registryItem: TransformerRegistryItem | undefined;
  transformId: string;
  transformConfig: DataTransformerConfig;
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
