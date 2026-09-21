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
