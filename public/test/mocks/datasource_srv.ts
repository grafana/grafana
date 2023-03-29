import { Observable } from 'rxjs';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
  DataSourceRef,
  getDataSourceUID,
} from '@grafana/data';

export class DatasourceSrvMock {
  constructor(private defaultDS: DataSourceApi, private datasources: { [name: string]: DataSourceApi }) {
    //
  }

  get(ref?: DataSourceRef | string): Promise<DataSourceApi> {
    if (!ref) {
      return Promise.resolve(this.defaultDS);
    }
    const uid = getDataSourceUID(ref) ?? '';
    const ds = this.datasources[uid];
    if (ds) {
      return Promise.resolve(ds);
    }
    return Promise.reject(`Unknown Datasource: ${JSON.stringify(ref)}`);
  }
}

export class MockDataSourceApi extends DataSourceApi {
  result: DataQueryResponse = { data: [] };

  constructor(
    name?: string,
    result?: DataQueryResponse,
    meta?: DataSourcePluginMeta,
    public error: string | null = null
  ) {
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

  setupMixed(value: boolean) {
    this.meta = this.meta || {};
    this.meta.mixed = value;
    return this;
  }
}

export class MockObservableDataSourceApi extends DataSourceApi {
  results: DataQueryResponse[] = [{ data: [] }];

  constructor(
    name?: string,
    results?: DataQueryResponse[],
    meta?: DataSourcePluginMeta,
    private error: string | null = null
  ) {
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
