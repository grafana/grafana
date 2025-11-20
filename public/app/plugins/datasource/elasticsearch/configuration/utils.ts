import { DataSourceSettings, SelectableValue } from '@grafana/data';

import { ElasticsearchOptions, QueryType } from '../types';

import { defaultMaxConcurrentShardRequests, defaultQueryMode } from './ElasticDetails';

export const QUERY_TYPE_SELECTOR_OPTIONS: Array<SelectableValue<QueryType>> = [
  { value: 'metrics', label: 'Metrics' },
  { value: 'logs', label: 'Logs' },
  { value: 'raw_data', label: 'Raw Data' },
  { value: 'raw_document', label: 'Raw Document' },
];

export const coerceOptions = (
  options: DataSourceSettings<ElasticsearchOptions, {}>
): DataSourceSettings<ElasticsearchOptions, {}> => {
  return {
    ...options,
    jsonData: {
      ...options.jsonData,
      timeField: options.jsonData.timeField || '@timestamp',
      maxConcurrentShardRequests: options.jsonData.maxConcurrentShardRequests || defaultMaxConcurrentShardRequests(),
      logMessageField: options.jsonData.logMessageField || '',
      logLevelField: options.jsonData.logLevelField || '',
      includeFrozen: options.jsonData.includeFrozen ?? false,
      defaultQueryMode: options.jsonData.defaultQueryMode || defaultQueryMode(),
    },
  };
};

export const isValidOptions = (options: DataSourceSettings<ElasticsearchOptions, {}>): boolean => {
  return (
    // timeField should not be empty or nullish
    !!options.jsonData.timeField &&
    // maxConcurrentShardRequests should be a number AND greater than 0
    !!options.jsonData.maxConcurrentShardRequests &&
    // message & level fields should be defined
    options.jsonData.logMessageField !== undefined &&
    options.jsonData.logLevelField !== undefined
  );
};
