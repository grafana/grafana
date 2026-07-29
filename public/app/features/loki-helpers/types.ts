import { type DataSourceApi, type DataSourceJsonData, type DataSourceWithLogsLabelTypesSupport } from '@grafana/data';
import type * as common from '@grafana/schema';

enum QueryEditorMode {
  Builder = 'builder',
  Code = 'code',
}

export enum LokiQueryType {
  Instant = 'instant',
  Range = 'range',
  Stream = 'stream',
}

export enum SupportingQueryType {
  DataSample = 'dataSample',
  InfiniteScroll = 'infiniteScroll',
  LogsSample = 'logsSample',
  LogsVolume = 'logsVolume',
}

export enum LokiQueryDirection {
  Backward = 'backward',
  Forward = 'forward',
  Scan = 'scan',
}

interface LokiQueryFromSchema extends common.DataQuery {
  editorMode?: QueryEditorMode;
  /**
   * The LogQL query.
   */
  expr: string;
  /**
   * @deprecated, now use queryType.
   */
  instant?: boolean;
  /**
   * Used to override the name of the series.
   */
  legendFormat?: string;
  /**
   * The full query plan for split/shard queries. Encoded and sent to Loki via `X-Loki-Query-Limits-Context` header. Requires "lokiQueryLimitsContext" feature flag
   */
  limitsContext?: {
    expr: string;
    from: number;
    to: number;
  };
  /**
   * Used to limit the number of log rows returned.
   */
  maxLines?: number;
  /**
   * @deprecated, now use queryType.
   */
  range?: boolean;
  /**
   * @deprecated, now use step.
   */
  resolution?: number;
  /**
   * Used to set step value for range queries.
   */
  step?: string;
}

export interface LokiQuery extends LokiQueryFromSchema {
  direction?: LokiQueryDirection;
  /** Used only to identify supporting queries, e.g. logs volume, logs sample and data sample */
  supportingQueryType?: SupportingQueryType;
  // CUE autogenerates `queryType` as `?string`, as that's how it is defined
  // in the parent-interface (in DataQuery).
  // the temporary fix (until this gets improved in the codegen), is to
  // override it here
  queryType?: LokiQueryType;
}

type DerivedFieldConfig = {
  matcherRegex: string;
  name: string;
  url?: string;
  urlDisplayLabel?: string;
  datasourceUid?: string;
  matcherType?: 'label' | 'regex';
  targetBlank?: boolean;
};

export interface LokiOptions extends DataSourceJsonData {
  maxLines?: string;
  derivedFields?: DerivedFieldConfig[];
  alertmanager?: string;
  keepCookies?: string[];
}

export type LokiDatasource = DataSourceApi<LokiQuery, LokiOptions> & DataSourceWithLogsLabelTypesSupport;
