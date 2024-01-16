import { Observable } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceJsonData,
  DataSourcePluginMeta,
  DataSourceRef,
  ScopedVars,
  TestDataSourceResponse,
} from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';

import LokiLanguageProvider from './LanguageProvider';
import { Loki as LokiQueryFromSchema, LokiQueryType, SupportingQueryType, LokiQueryDirection } from './dataquery.gen';

export { LokiQueryType };

export enum LokiResultType {
  Stream = 'streams',
  Vector = 'vector',
  Matrix = 'matrix',
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

  /**
   * This is a property for the experimental query splitting feature.
   * @experimental
   */
  splitDuration?: string;
}

export interface LokiOptions extends DataSourceJsonData {
  maxLines?: string;
  derivedFields?: DerivedFieldConfig[];
  alertmanager?: string;
  keepCookies?: string[];
  predefinedOperations?: string;
}

export type DerivedFieldConfig = {
  matcherRegex: string;
  name: string;
  url?: string;
  urlDisplayLabel?: string;
  datasourceUid?: string;
  matcherType?: 'label' | 'regex';
};

export interface QueryStats {
  streams: number;
  chunks: number;
  bytes: number;
  entries: number;
  // The error message displayed in the UI when we cant estimate the size of the query.
  message?: string;
}

export type LokiDatasource = {
  name: string;
  id: number;
  type: string;
  uid: string;
  query: (request: DataQueryRequest<any>) => Observable<DataQueryResponse> | Promise<DataQueryResponse>;
  testDatasource: () => Promise<TestDataSourceResponse>;
  meta: DataSourcePluginMeta<{}>;
  getRef: () => DataSourceRef;
  metadataRequest: (
    url: string,
    params?: Record<string, string | number>,
    options?: Partial<BackendSrvRequest>
  ) => Promise<any>;
  getTimeRangeParams: () => any;
  interpolateString: (string: string, scopedVars?: ScopedVars) => string;
  getDataSamples: (query: LokiQuery) => Promise<DataFrame[]>;
  languageProvider: any;
};

export interface ParserAndLabelKeysResult {
  extractedLabelKeys: string[];
  hasJSON: boolean;
  hasLogfmt: boolean;
  hasPack: boolean;
  unwrapLabelKeys: string[];
}

export type LanguageProvider = LokiLanguageProvider;
