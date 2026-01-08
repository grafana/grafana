import { Observable } from 'rxjs';

import {
  DataQuery,
  DataSourceJsonData,
  PluginMetaInfo,
  DataSourcePluginMeta,
  PluginType,
  DataSourceInstanceSettings,
  DataSourceApi,
  DataQueryRequest,
  DataQueryResponse,
  TestDataSourceResponse,
} from '@grafana/data';

export interface TestQuery extends DataQuery {
  q?: string;
}

export interface TestJsonData extends DataSourceJsonData {
  url?: string;
}

const info: PluginMetaInfo = {
  author: {
    name: '',
  },
  description: '',
  links: [],
  logos: {
    large: '',
    small: '',
  },
  screenshots: [],
  updated: '',
  version: '',
};

export const meta: DataSourcePluginMeta<DataSourceJsonData> = {
  id: '',
  name: '',
  type: PluginType.datasource,
  info,
  module: '',
  baseUrl: '',
};

export const TestDataSettings: DataSourceInstanceSettings<TestJsonData> = {
  jsonData: { url: 'http://localhost:3000' },
  id: 0,
  uid: '',
  type: '',
  name: 'Test Datasource',
  meta,
  readOnly: false,
  access: 'direct',
};

export class TestDataSource extends DataSourceApi<TestQuery, DataSourceJsonData, {}> {
  constructor(instanceSettings: DataSourceInstanceSettings<TestJsonData> = TestDataSettings) {
    super(instanceSettings);
  }

  query(request: DataQueryRequest<TestQuery>): Promise<DataQueryResponse> | Observable<DataQueryResponse> {
    return Promise.resolve({
      data: [],
    });
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    throw new Error('Method not implemented.');
  }
}

export const getMockDataSource = () => {
  return new TestDataSource();
};
