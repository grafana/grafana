import { DataQuery } from '@grafana/data';
import { DataSourceJsonData } from '@grafana/data/src';
import { NodeGraphOptions } from 'app/core/components/NodeGraphSettings';
import { TraceToLogsOptions } from 'app/core/components/TraceToLogs/TraceToLogsSettings';

import { LokiQuery } from '../loki/types';

export interface SearchQueryParams {
  minDuration?: string;
  maxDuration?: string;
  limit?: number;
  tags?: string;
  start?: number;
  end?: number;
}

export interface TempoJsonData extends DataSourceJsonData {
  tracesToLogs?: TraceToLogsOptions;
  serviceMap?: {
    datasourceUid?: string;
  };
  search?: {
    hide?: boolean;
  };
  nodeGraph?: NodeGraphOptions;
  lokiSearch?: {
    datasourceUid?: string;
  };
  spanBar?: {
    tag: string;
  };
}

// search = Loki search, nativeSearch = Tempo search for backwards compatibility
export type TempoQueryType = 'traceql' | 'search' | 'traceId' | 'serviceMap' | 'upload' | 'nativeSearch' | 'clear';

export interface TempoQuery extends DataQuery {
  query: string;
  // Query to find list of traces, e.g., via Loki
  linkedQuery?: LokiQuery;
  search?: string;
  queryType: TempoQueryType;
  serviceName?: string;
  spanName?: string;
  minDuration?: string;
  maxDuration?: string;
  limit?: number;
  serviceMapQuery?: string;
}

export interface MyDataSourceOptions extends DataSourceJsonData {}

export const defaultQuery: Partial<TempoQuery> = {};
