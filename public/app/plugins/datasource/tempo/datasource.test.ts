import { DataSourceInstanceSettings, FieldType, MutableDataFrame, PluginType } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { TempoDatasource } from './datasource';

jest.mock('../../../../../packages/grafana-runtime/src/services/backendSrv.ts', () => ({
  getBackendSrv: () => backendSrv,
}));

jest.mock('../../../../../packages/grafana-runtime/src/utils/queryResponse.ts', () => ({
  toDataQueryResponse: (resp: any) => resp,
}));

describe('Tempo data source', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns trace when queried', async () => {
    const responseDataFrame = new MutableDataFrame({ fields: [{ name: 'trace', values: ['{}'] }] });
    setupBackendSrv([responseDataFrame]);
    const ds = new TempoDatasource(defaultSettings);
    await expect(ds.query({ targets: [{ query: '12345' }] } as any)).toEmitValuesWith((response) => {
      const field = response[0].data[0].fields[0];
      expect(field.name).toBe('trace');
      expect(field.type).toBe(FieldType.trace);
    });
  });
});

function setupBackendSrv(response: any) {
  const defaultMock = () => of(createFetchResponse(response));

  const fetchMock = jest.spyOn(backendSrv, 'fetch');
  fetchMock.mockImplementation(defaultMock);
}

const defaultSettings: DataSourceInstanceSettings = {
  id: 0,
  uid: '0',
  type: 'tracing',
  name: 'jaeger',
  meta: {
    id: 'jaeger',
    name: 'jaeger',
    type: PluginType.datasource,
    info: {} as any,
    module: '',
    baseUrl: '',
  },
  jsonData: {},
};
