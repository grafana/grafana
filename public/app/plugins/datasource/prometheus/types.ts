import { DataSourceJsonData, QueryResultMeta, ScopedVars } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { PromApplication } from '../../../types/unified-alerting-dto';

import { Prometheus as GenPromQuery } from './dataquery.gen';
import { QueryEditorMode } from './querybuilder/shared/types';

export interface PromQuery extends GenPromQuery, DataQuery {
  /**
   * Timezone offset to align start & end time on backend
   */
  utcOffsetSec?: number;
  legendFormat?: string;
  valueWithRefId?: boolean;
  requestId?: string;
  showingGraph?: boolean;
  showingTable?: boolean;
  hinting?: boolean;
  interval?: string;
  intervalFactor?: number;
}

export interface PromOptions extends DataSourceJsonData {
  timeInterval?: string;
  queryTimeout?: string;
  httpMethod?: string;
  directUrl?: string;
  customQueryParameters?: string;
  disableMetricsLookup?: boolean;
  exemplarTraceIdDestinations?: ExemplarTraceIdDestination[];
  prometheusType?: PromApplication;
  prometheusVersion?: string;
  defaultEditor?: QueryEditorMode;
  incrementalQuerying?: boolean;
  incrementalQueryOverlapWindow?: string;
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

export interface PromDataSuccessResponse<T = PromData> {
  status: 'success';
  data: T;
}

export interface PromDataErrorResponse<T = PromData> {
  status: 'error';
  errorType: string;
  error: string;
  data: T;
}

export type PromData = PromMatrixData | PromVectorData | PromScalarData | PromExemplarData[];

export interface Labels {
  [index: string]: any;
}

export interface Exemplar {
  labels: Labels;
  value: number;
  timestamp: number;
}

export interface PromExemplarData {
  seriesLabels: PromMetric;
  exemplars: Exemplar[];
}

export interface PromVectorData {
  resultType: 'vector';
  result: Array<{
    metric: PromMetric;
    value: PromValue;
  }>;
}

export interface PromMatrixData {
  resultType: 'matrix';
  result: Array<{
    metric: PromMetric;
    values: PromValue[];
  }>;
}

export interface PromScalarData {
  resultType: 'scalar';
  result: PromValue;
}

export type PromValue = [number, any];

export interface PromMetric {
  __name__?: string;

  [index: string]: any;
}

export function isMatrixData(result: MatrixOrVectorResult): result is PromMatrixData['result'][0] {
  return 'values' in result;
}

export function isExemplarData(result: PromData): result is PromExemplarData[] {
  if (result == null || !Array.isArray(result)) {
    return false;
  }
  return result.length ? 'exemplars' in result[0] : false;
}

export type MatrixOrVectorResult = PromMatrixData['result'][0] | PromVectorData['result'][0];

export interface TransformOptions {
  format?: string;
  step?: number;
  legendFormat?: string;
  start: number;
  end: number;
  query: string;
  responseListLength: number;
  scopedVars?: ScopedVars;
  refId: string;
  valueWithRefId?: boolean;
  meta: QueryResultMeta;
}

export interface PromLabelQueryResponse {
  data: {
    status: string;
    data: string[];
  };
  cancelled?: boolean;
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
}

export interface PromVariableQuery extends DataQuery {
  query?: string;
  expr?: string;
  qryType?: PromVariableQueryType;
  label?: string;
  metric?: string;
  varQuery?: string;
  seriesQuery?: string;
}

export type StandardPromVariableQuery = {
  query: string;
  refId: string;
};
