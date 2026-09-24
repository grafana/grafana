import { type DataSourceInstanceListItem, type DataSourcePluginMeta } from '@grafana/data';
import { type BackendSrv, type DataSourceSrv } from '@grafana/runtime';

export function getMockedDatasourceSrv() {
  return {
    get: jest.fn(),
    getInstanceSettings: jest.fn(),
    getList: jest.fn(),
    registerRuntimeDataSource: jest.fn(),
    reload: jest.fn(),
  } satisfies DataSourceSrv;
}

export function getMockedBackendSrv() {
  return {
    chunked: jest.fn(),
    delete: jest.fn(),
    fetch: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    datasourceRequest: jest.fn(),
    request: jest.fn(),
  } satisfies BackendSrv;
}

// `meta` is partial so a case can set just the one flag it cares about.
export function getMockedListItem({
  meta,
  ...rest
}: Partial<Omit<DataSourceInstanceListItem, 'meta'>> & {
  meta?: Partial<DataSourcePluginMeta>;
} = {}): DataSourceInstanceListItem {
  return {
    uid: 'uid',
    type: 'loki',
    name: 'name',
    isDefault: false,
    ...rest,
    meta: { ...meta },
  } as DataSourceInstanceListItem;
}
