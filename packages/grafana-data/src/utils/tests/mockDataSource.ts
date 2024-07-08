import { Observable } from 'rxjs';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourcePluginMeta,
  TestDataSourceResponse,
} from '../../types/datasource';
import { PluginMetaInfo, PluginType } from '../../types/plugin';
import { DataQuery } from '../../types/query';

export interface TestQuery extends DataQuery {
  query: string;
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

export class TestDataSource extends DataSourceApi<TestQuery, DataSourceJsonData> {
  query(request: DataQueryRequest<TestQuery>): Promise<DataQueryResponse> | Observable<DataQueryResponse> {
    throw new Error('Method not implemented.');
  }
  testDatasource(): Promise<TestDataSourceResponse> {
    throw new Error('Method not implemented.');
  }
  constructor(instanceSettings: DataSourceInstanceSettings<TestJsonData> = TestDataSettings) {
    super(instanceSettings);
  }
}
