import { DataSourceApi, DataQueryRequest, DataSourceStream, DataQueryResponse } from '@grafana/ui';

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

export class MockDataSourceApi implements DataSourceApi {
  constructor(private res: DataQueryResponse) {}

  query(request: DataQueryRequest, stream: DataSourceStream): Promise<DataQueryResponse> {
    return Promise.resolve(this.res); // empty data
  }

  testDatasource() {
    return Promise.resolve();
  }
}
