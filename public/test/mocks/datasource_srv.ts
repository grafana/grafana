import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
} from '@grafana/data';
import { Observable } from 'rxjs';

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

    return new Promise((resolver) => {
      setTimeout(() => {
        resolver(this.result);
      });
    });
  }

  testDatasource() {
    return Promise.resolve();
  }
}

export class MockObservableDataSourceApi extends DataSourceApi {
  results: DataQueryResponse[] = [{ data: [] }];

  constructor(name?: string, results?: DataQueryResponse[], meta?: any, private error: string | null = null) {
    super({ name: name ? name : 'MockDataSourceApi' } as DataSourceInstanceSettings);

    if (results) {
      this.results = results;
    }

    this.meta = meta || ({} as DataSourcePluginMeta);
  }

  query(request: DataQueryRequest): Observable<DataQueryResponse> {
    return new Observable((observer) => {
      if (this.error) {
        observer.error(this.error);
      }

      if (this.results) {
        this.results.forEach((response) => observer.next(response));
        observer.complete();
      }
    });
  }

  testDatasource() {
    return Promise.resolve();
  }
}
