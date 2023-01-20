import * as raw from '../common/common.gen';

export interface DataQuery extends raw.DataQuery {
  // TODO remove explicit nulls
  datasource?: raw.DataSourceRef | null;
}

export * from '../common/common.gen';
