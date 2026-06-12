import { type DataQuery, type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';

let instance: DataSourceApi | undefined;
let instanceSettings: DataSourceInstanceSettings | undefined;

export function setExpressionDataSourceInstance<TQuery extends DataQuery>(ds: DataSourceApi<TQuery>): void {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  instance = ds as DataSourceApi;
  // Extract settings once at registration so lookups need no cast.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  instanceSettings = (ds as unknown as { instanceSettings?: DataSourceInstanceSettings }).instanceSettings;
}

export function getExpressionDataSourceInstance(): DataSourceApi | undefined {
  return instance;
}

export function getExpressionDataSourceSettings(): DataSourceInstanceSettings | undefined {
  return instanceSettings;
}

export function _resetForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_resetForTests must only be called from tests');
  }
  instance = undefined;
  instanceSettings = undefined;
}
