import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
} from '@grafana/data';

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

  constructor(name?: string, result?: DataQueryResponse, meta?: any, private error: string | null = null) {
    super({ name: name ? name : 'MockDataSourceApi' } as DataSourceInstanceSettings);
    if (result) {
      this.result = result;
    }

    this.meta = meta || ({} as DataSourcePluginMeta);
  }

  query(request: DataQueryRequest): Promise<DataQueryResponse> {
    if (this.error) {
      return Promise.reject(this.error);
    }

    return new Promise(resolver => {
      setTimeout(() => {
        resolver(this.result);
      });
    });
  }

  testDatasource() {
    return Promise.resolve();
  }
}
