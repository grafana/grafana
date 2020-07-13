import { ZipkinDatasource, ZipkinQuery } from './datasource';
import { DataQueryRequest, DataSourceInstanceSettings } from '@grafana/data';
import { BackendSrv, BackendSrvRequest, setBackendSrv } from '@grafana/runtime';
import { jaegerTrace, zipkinResponse } from './utils/testData';

describe('ZipkinDatasource', () => {
  describe('query', () => {
    it('runs query', async () => {
      setupBackendSrv({ url: '/api/datasources/proxy/1/api/v2/trace/12345', response: zipkinResponse });
      const ds = new ZipkinDatasource(defaultSettings);
      const response = await ds.query({ targets: [{ query: '12345' }] } as DataQueryRequest<ZipkinQuery>).toPromise();
      expect(response.data[0].fields[0].values.get(0)).toEqual(jaegerTrace);
    });
    it('runs query with traceId that includes special characters', async () => {
      setupBackendSrv({ url: '/api/datasources/proxy/1/api/v2/trace/a%2Fb', response: zipkinResponse });
      const ds = new ZipkinDatasource(defaultSettings);
      const response = await ds.query({ targets: [{ query: 'a/b' }] } as DataQueryRequest<ZipkinQuery>).toPromise();
      expect(response.data[0].fields[0].values.get(0)).toEqual(jaegerTrace);
    });
  });

  describe('metadataRequest', () => {
    it('runs query', async () => {
      setupBackendSrv({ url: '/api/datasources/proxy/1/api/v2/services', response: ['service 1', 'service 2'] });
      const ds = new ZipkinDatasource(defaultSettings);
      const response = await ds.metadataRequest('/api/v2/services');
      expect(response).toEqual(['service 1', 'service 2']);
    });
  });
});

function setupBackendSrv<T>({ url, response }: { url: string; response: T }): void {
  setBackendSrv({
    datasourceRequest(options: BackendSrvRequest): Promise<any> {
      if (options.url === url) {
        return Promise.resolve({ data: response });
      }
      throw new Error(`Unexpected url ${options.url}`);
    },
  } as BackendSrv);
}

const defaultSettings: DataSourceInstanceSettings = {
  id: 1,
  uid: '1',
  type: 'tracing',
  name: 'zipkin',
  meta: {} as any,
  jsonData: {},
};
