import { DataFrameDTO, FieldConfig } from './dataFrame';
import { DataFrameType } from './dataFrameTypes';
import { ApplyFieldOverrideOptions } from './fieldOverrides';
import { PanelPluginDataSupport } from './panel';
import { DataTopic } from './query';
import { DataTransformerConfig } from './transformations';

export type KeyValue<T = any> = Record<string, T>;

/**
 * Represent panel data loading state.
 * @public
 */
export enum LoadingState {
  NotStarted = 'NotStarted',
  Loading = 'Loading',
  Streaming = 'Streaming',
  Done = 'Done',
  Error = 'Error',
}

// Should be kept in sync with grafana-plugin-sdk-go/data/frame_meta.go
export const preferredVisualizationTypes = [
  'graph',
  'table',
  'logs',
  'trace',
  'nodeGraph',
  'flamegraph',
  'rawPrometheus',
] as const;
export type PreferredVisualisationType = (typeof preferredVisualizationTypes)[number];

/**
 * Should be kept in sync with https://github.com/grafana/grafana-plugin-sdk-go/blob/main/data/frame_meta.go
 * @public
 */
export interface QueryResultMeta {
  type?: DataFrameType;

  /**
   * TypeVersion is the version of the Type property. Versions greater than 0.0 correspond to the dataplane
   * contract documentation https://github.com/grafana/grafana-plugin-sdk-go/tree/main/data/contract_docs.
   */
  typeVersion?: [number, number];

  /** DatasSource Specific Values */
  custom?: Record<string, any>;

  /** Stats */
  stats?: QueryResultMetaStat[];

  /** Meta Notices */
  notices?: QueryResultMetaNotice[];

  /** Currently used to show results in Explore only in preferred visualisation option */
  preferredVisualisationType?: PreferredVisualisationType;

  /** Set the panel plugin id to use to render the data when using Explore. If the plugin cannot be found
   * will fall back to {@link preferredVisualisationType}.
   *
   * @alpha
   */
  preferredVisualisationPluginId?: string;

  /** The path for live stream updates for this frame */
  channel?: string;

  /** Did the query response come from the cache */
  isCachedResponse?: boolean;

  /**
   * Optionally identify which topic the frame should be assigned to.
   * A value specified in the response will override what the request asked for.
   */
  dataTopic?: DataTopic;

  /**
   * This is the raw query sent to the underlying system.  All macros and templating
   * as been applied.  When metadata contains this value, it will be shown in the query inspector
   */
  executedQueryString?: string;

  /**
   * A browsable path on the datasource
   */
  path?: string;

  /**
   * defaults to '/'
   */
  pathSeparator?: string;

  /** A time shift metadata indicating a result of comparison */
  timeCompare?: {
    diffMs: number;
    isTimeShiftQuery: boolean;
  };

  /**
   * Legacy data source specific, should be moved to custom
   * */
  searchWords?: string[]; // used by log models and loki
  limit?: number; // used by log models and loki
  json?: boolean; // used to keep track of old json doc values
  instant?: boolean;

  /**
   * Array of field indices which values create a unique id for each row. Ideally this should be globally unique ID
   * but that isn't guarantied. Should help with keeping track and deduplicating rows in visualizations, especially
   * with streaming data with frequent updates.
   * Example: TraceID in Tempo, table name + primary key in SQL
   */
  uniqueRowIdFields?: number[];
}

export interface QueryResultMetaStat extends FieldConfig {
  displayName: string;
  value: number;
}

/**
 * QueryResultMetaNotice is a structure that provides user notices for query result data
 * @public
 */
export interface QueryResultMetaNotice {
  /**
   * Specify the notice severity
   */
  severity: 'info' | 'warning' | 'error';

  /**
   * Notice descriptive text
   */
  text: string;

  /**
   * An optional link that may be displayed in the UI.
   * This value may be an absolute URL or relative to grafana root
   */
  link?: string;

  /**
   * Optionally suggest an appropriate tab for the panel inspector
   */
  inspect?: 'meta' | 'error' | 'data' | 'stats';
}

/**
 * @public
 */
export interface QueryResultBase {
  /**
   * Matches the query target refId
   */
  refId?: string;

  /**
   * Used by some backend data sources to communicate back info about the execution (generated sql, timing)
   */
  meta?: QueryResultMeta;
}

export interface Labels {
  [key: string]: string;
}

/** @deprecated this is a very old (pre Grafana 7 + DataFrame) representation for tabular data  */
export interface Column {
  text: string; // For a Column, the 'text' is the field name
  filterable?: boolean;
  unit?: string;
  custom?: Record<string, any>;
}

/** @deprecated this is a very old (pre Grafana 7 + DataFrame) representation for tabular data  */
export interface TableData extends QueryResultBase {
  name?: string;
  columns: Column[];
  rows: any[][];
  type?: string;
}

/** @deprecated this is a very old (pre Grafana 7 + DataFrame) representation for tabular data  */
export type TimeSeriesValue = number | null;

/** @deprecated this is a very old (pre Grafana 7 + DataFrame) representation for tabular data  */
export type TimeSeriesPoints = TimeSeriesValue[][];

/** @deprecated this is a very old (pre Grafana 7 + DataFrame) representation for tabular data  */
export interface TimeSeries extends QueryResultBase {
  target: string;
  /**
   * If name is manually configured via an alias / legend pattern
   */
  title?: string;
  datapoints: TimeSeriesPoints;
  unit?: string;
  tags?: Labels;
}

export enum NullValueMode {
  Null = 'null',
  Ignore = 'connected',
  AsZero = 'null as zero',
}

/**
 * Describes and API for exposing panel specific data configurations.
 */
export interface DataConfigSource {
  configRev?: number;
  getDataSupport: () => PanelPluginDataSupport;
  getTransformations: () => DataTransformerConfig[] | undefined;
  getFieldOverrideOptions: () => ApplyFieldOverrideOptions | undefined;
  snapshotData?: DataFrameDTO[];
}

type Truthy<T> = T extends false | '' | 0 | null | undefined ? never : T;
export const isTruthy = <T>(value: T): value is Truthy<T> => Boolean(value);

/**
 * Serves no runtime purpose - only used to make typescript check a value has been correctly
 * narrowed to an object
 */
function identityObject(value: object): object {
  return value;
}

/**
 * Utility type predicate to check if a value is typeof object, but excludes "null".
 *
 * We normally discourage the use of type predicates in favor of just inline typescript narrowing,
 * but this is a special case to handle null annoyingly being typeof object
 */
export function isObject(value: unknown): value is object {
  if (typeof value === 'object' && value !== null) {
    identityObject(value);

    return true;
  }

  return false;
}
