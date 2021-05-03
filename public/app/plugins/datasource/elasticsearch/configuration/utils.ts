import { DataSourceSettings } from '@grafana/data';
import { valid } from 'semver';
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
      maxConcurrentShardRequests:
        options.jsonData.maxConcurrentShardRequests || defaultMaxConcurrentShardRequests(esVersion),
      logMessageField: options.jsonData.logMessageField || '',
      logLevelField: options.jsonData.logLevelField || '',
    },
  };
};

export const isValidOptions = (options: DataSourceSettings<ElasticsearchOptions, {}>): boolean => {
  if (
    !valid(options.jsonData.esVersion) ||
    !!options.jsonData.timeField ||
    !!options.jsonData.maxConcurrentShardRequests ||
    options.jsonData.logMessageField === undefined ||
    options.jsonData.logLevelField === undefined
  ) {
    return false;
  }

  return true;
};
