import { valid } from 'semver';

import { DataSourceSettings } from '@grafana/data';

import { ElasticsearchOptions } from '../types';
import { coerceESVersion } from '../utils';

import { defaultMaxConcurrentShardRequests } from './ElasticDetails';

export const coerceOptions = (
  options: DataSourceSettings<ElasticsearchOptions, {}>
): DataSourceSettings<ElasticsearchOptions, {}> => {
  const esVersion = coerceESVersion(options.jsonData.esVersion);

  return {
    ...options,
    jsonData: {
      ...options.jsonData,
      timeField: options.jsonData.timeField || '@timestamp',
      esVersion,
      maxConcurrentShardRequests: options.jsonData.maxConcurrentShardRequests || defaultMaxConcurrentShardRequests(),
      logMessageField: options.jsonData.logMessageField || '',
      logLevelField: options.jsonData.logLevelField || '',
      includeFrozen: options.jsonData.includeFrozen ?? false,
    },
  };
};

export const isValidOptions = (options: DataSourceSettings<ElasticsearchOptions, {}>): boolean => {
  return (
    // esVersion should be a valid semver string
    !!valid(options.jsonData.esVersion) &&
    // timeField should not be empty or nullish
    !!options.jsonData.timeField &&
    // maxConcurrentShardRequests should be a number AND greater than 0
    !!options.jsonData.maxConcurrentShardRequests &&
    // message & level fields should be defined
    options.jsonData.logMessageField !== undefined &&
    options.jsonData.logLevelField !== undefined
  );
};

type Truthy<T> = T extends false | '' | 0 | null | undefined ? never : T;

export const isTruthy = <T>(value: T): value is Truthy<T> => Boolean(value);
