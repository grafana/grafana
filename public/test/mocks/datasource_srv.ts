import { DataSourceApi, DataQueryRequest, DataQueryResponse, DataStreamEventObserver } from '@grafana/ui';

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
  name: string;

  constructor(private res: DataQueryResponse, name?: string) {
    this.name = name ? name : 'MockDataSourceApi';
  }

  query(request: DataQueryRequest, stream: DataStreamEventObserver): Promise<DataQueryResponse> {
    return Promise.resolve(this.res); // empty data
  }

  testDatasource() {
    return Promise.resolve();
  }
}
