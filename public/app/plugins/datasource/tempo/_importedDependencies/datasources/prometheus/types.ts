import { type Observable } from 'rxjs';

import {
  type DataQueryRequest,
  type DataQueryResponse,
  type DataSourceGetTagKeysOptions,
  type MetricFindValue,
} from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { type Prometheus as GenPromQuery } from './dataquery.gen';

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

export type PrometheusDatasource = {
  getTagKeys(options: DataSourceGetTagKeysOptions): Promise<MetricFindValue[]>;
  query(request: DataQueryRequest<PromQuery>): Observable<DataQueryResponse>;
};
