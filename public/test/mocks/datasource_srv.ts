import {
  DataSourceApi,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
} from '@grafana/ui';

export class DatasourceSrvMock {
  constructor(private defaultDS: DataSourceApi, private datasources: { [name: string]: DataSourceApi }) {
    //
  }

  get(name?: string): Promise<DataSourceApi> {
    if (!name) {
      return Promise.resolve(this.defaultDS);
    }
    const ds = this.datasources[name];
    if (ds) {
      return Promise.resolve(ds);
    }
    return Promise.reject('Unknown Datasource: ' + name);
  }
}

export class MockDataSourceApi extends DataSourceApi {
  result: DataQueryResponse = { data: [] };
  queryResolver: Promise<DataQueryResponse>;

  constructor(name?: string, result?: DataQueryResponse) {
    super({ name: name ? name : 'MockDataSourceApi' } as DataSourceInstanceSettings);
    if (result) {
      this.result = result;
    }

    this.meta = {} as DataSourcePluginMeta;
  }

  query(request: DataQueryRequest): Promise<DataQueryResponse> {
    if (this.queryResolver) {
      return this.queryResolver;
    }
    return Promise.resolve(this.result);
  }

  testDatasource() {
    return Promise.resolve();
  }
}
