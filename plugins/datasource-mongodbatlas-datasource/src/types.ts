import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  queryText?: string;
  constant: number;
}

export const DEFAULT_QUERY: Partial<MyQuery> = {
  constant: 6.5,
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  path?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}

export interface MyDataSourceOptions {
  clusterName?: string;
  databaseName?: string;
  collectionName?: string;
}

export interface MySecureJsonData {
  apiKey?: string;
}

export interface MyQuery {
  queryText?: string;
  refId: string;
}