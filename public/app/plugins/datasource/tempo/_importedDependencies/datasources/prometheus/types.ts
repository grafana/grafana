import { Observable } from 'rxjs';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceGetTagKeysOptions,
  DataSourceJsonData,
  MetricFindValue,
} from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { Prometheus as GenPromQuery } from './dataquery.gen';

// import { QueryBuilderLabelFilter, QueryEditorMode } from './querybuilder/shared/types';
export interface QueryBuilderLabelFilter {
  label: string;
  op: string;
  value: string;
}

export enum QueryEditorMode {
  Code = 'code',
  Builder = 'builder',
}

export interface PromQuery extends GenPromQuery, DataQuery {
  /**
   * Timezone offset to align start & end time on backend
   */
  utcOffsetSec?: number;
  valueWithRefId?: boolean;
  showingGraph?: boolean;
  showingTable?: boolean;
  hinting?: boolean;
  interval?: string;
  // store the metrics explorer additional settings
  useBackend?: boolean;
  disableTextWrap?: boolean;
  fullMetaSearch?: boolean;
  includeNullMetadata?: boolean;
}

export enum PrometheusCacheLevel {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  None = 'None',
}

export enum PromApplication {
  Cortex = 'Cortex',
  Mimir = 'Mimir',
  Prometheus = 'Prometheus',
  Thanos = 'Thanos',
}

export interface PromOptions extends DataSourceJsonData {
  timeInterval?: string;
  queryTimeout?: string;
  httpMethod?: string;
  customQueryParameters?: string;
  disableMetricsLookup?: boolean;
  exemplarTraceIdDestinations?: ExemplarTraceIdDestination[];
  prometheusType?: PromApplication;
  prometheusVersion?: string;
  cacheLevel?: PrometheusCacheLevel;
  defaultEditor?: QueryEditorMode;
  incrementalQuerying?: boolean;
  incrementalQueryOverlapWindow?: string;
  disableRecordingRules?: boolean;
  sigV4Auth?: boolean;
  oauthPassThru?: boolean;
}

export type ExemplarTraceIdDestination = {
  name: string;
  url?: string;
  urlDisplayLabel?: string;
  datasourceUid?: string;
};

export interface PromQueryRequest extends PromQuery {
  step?: number;
  requestId?: string;
  start: number;
  end: number;
  headers?: any;
}

export interface PromMetricsMetadataItem {
  type: string;
  help: string;
  unit?: string;
}

export interface PromMetricsMetadata {
  [metric: string]: PromMetricsMetadataItem;
}

export type PromValue = [number, any];

export interface PromMetric {
  __name__?: string;

  [index: string]: any;
}

export interface PromBuildInfoResponse {
  data: {
    application?: string;
    version: string;
    revision: string;
    features?: {
      ruler_config_api?: 'true' | 'false';
      alertmanager_config_api?: 'true' | 'false';
      query_sharding?: 'true' | 'false';
      federated_rules?: 'true' | 'false';
    };
    [key: string]: unknown;
  };
  status: 'success';
}

/**
 * Auto = query.legendFormat == '__auto'
 * Verbose = query.legendFormat == null/undefined/''
 * Custom query.legendFormat.length > 0 && query.legendFormat !== '__auto'
 */
export enum LegendFormatMode {
  Auto = '__auto',
  Verbose = '__verbose',
  Custom = '__custom',
}

export enum PromVariableQueryType {
  LabelNames,
  LabelValues,
  MetricNames,
  VarQueryResult,
  SeriesQuery,
  ClassicQuery,
}

export interface PromVariableQuery extends DataQuery {
  query?: string;
  expr?: string;
  qryType?: PromVariableQueryType;
  label?: string;
  metric?: string;
  varQuery?: string;
  seriesQuery?: string;
  labelFilters?: QueryBuilderLabelFilter[];
  match?: string;
  classicQuery?: string;
}

export type StandardPromVariableQuery = {
  query: string;
  refId: string;
};

export type PrometheusDatasource = {
  getTagKeys(options: DataSourceGetTagKeysOptions): Promise<MetricFindValue[]>;
  query(request: DataQueryRequest<PromQuery>): Observable<DataQueryResponse>;
};
