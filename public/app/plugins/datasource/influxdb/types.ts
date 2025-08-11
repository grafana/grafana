import { AdHocVariableFilter, DataQuery, DataSourceJsonData } from '@grafana/data';

export const DEFAULT_POLICY = 'default';

export enum InfluxVersion {
  InfluxQL = 'InfluxQL',
  Flux = 'Flux',
  SQL = 'SQL',
}

export interface InfluxOptions extends DataSourceJsonData {
  version?: InfluxVersion;

  timeInterval?: string;
  httpMode?: string;
  showTagTime?: string;

  dbName?: string;
  product?: string;
  pdcInjected?: boolean;
  oauthPassThru?: boolean;

  // With Flux
  organization?: string;
  defaultBucket?: string;
  maxSeries?: number;

  // With SQL
  metadata?: Array<Record<string, string>>;
  insecureGrpc?: boolean;
}

/**
 * @deprecated
 */
export interface InfluxOptionsV1 extends InfluxOptions {
  user?: string;
  database?: string;
}

export interface InfluxSecureJsonData {
  // For Flux
  token?: string;

  // In 1x a different password can be sent than then HTTP auth
  password?: string;
}

export interface InfluxQueryPart {
  type: string;
  params?: Array<string | number>;
  // FIXME: `interval` does not seem to be used.
  // check all the influxdb parts (query-generation etc.),
  // if it is really so, and if yes, remove it
  interval?: string;
}

export interface InfluxQueryTag {
  key: string;
  operator?: string;
  condition?: string;
  value: string;
}

export type ResultFormat = 'time_series' | 'table' | 'logs';

export interface InfluxVariableQuery extends DataQuery {
  query: string;
  maxDataPoints?: number;
}

export interface InfluxQuery extends DataQuery {
  policy?: string;
  measurement?: string;
  resultFormat?: ResultFormat;
  orderByTime?: string;
  tags?: InfluxQueryTag[];
  groupBy?: InfluxQueryPart[];
  select?: InfluxQueryPart[][];
  limit?: string | number;
  slimit?: string | number;
  tz?: string;
  // NOTE: `fill` is not used in the query-editor anymore, and is removed
  // if any change happens in the query-editor. the query-generation still
  // supports it for now.
  fill?: string;
  rawQuery?: boolean;
  query?: string;
  alias?: string;
  // for migrated InfluxQL annotations
  queryType?: string;
  fromAnnotations?: boolean;
  tagsColumn?: string;
  textColumn?: string;
  timeEndColumn?: string;
  titleColumn?: string;
  name?: string;
  matchAny?: boolean;
  type?: string;

  textEditor?: boolean;
  adhocFilters?: AdHocVariableFilter[];
}

export type MetadataQueryType = 'TAG_KEYS' | 'TAG_VALUES' | 'MEASUREMENTS' | 'FIELDS' | 'RETENTION_POLICIES';
