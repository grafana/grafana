import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { FetchError } from '@grafana/runtime';

export interface PromQuery extends DataQuery {
  expr: string;
  format?: string;
  instant?: boolean;
  range?: boolean;
  hinting?: boolean;
  interval?: string;
  intervalFactor?: number;
  legendFormat?: string;
  valueWithRefId?: boolean;
  requestId?: string;
  showingGraph?: boolean;
  showingTable?: boolean;
}

export interface PromOptions extends DataSourceJsonData {
  timeInterval: string;
  queryTimeout: string;
  httpMethod: string;
  directUrl: string;
  customQueryParameters?: string;
  disableMetricsLookup?: boolean;
}

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
  [metric: string]: PromMetricsMetadataItem[];
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

export type PromData = PromMatrixData | PromVectorData | PromScalarData;

export interface PromVectorData {
  resultType: 'vector';
  result: Array<{
    metric: {
      __name__?: string;
      [index: string]: any;
    };
    value: PromValue;
  }>;
}

export interface PromMatrixData {
  resultType: 'matrix';
  result: Array<{
    metric: {
      __name__?: string;
      [index: string]: any;
    };
    values: PromValue[];
  }>;
}

export interface PromScalarData {
  resultType: 'scalar';
  result: PromValue;
}

export type PromValue = [number, any];

export function isFetchErrorResponse(response: any): response is FetchError {
  return 'cancelled' in response;
}
export interface PromLabelQueryResponse {
  data: {
    status: string;
    data: string[];
  };
  cancelled?: boolean;
}
