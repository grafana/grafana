import { DataFrame, dataFrameToJSON, DataSourceInstanceSettings, MutableDataFrame, PluginType } from '@grafana/data';
import { Observable, of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { TempoDatasource } from './datasource';
import { FetchResponse, setBackendSrv, BackendDataSourceResponse } from '@grafana/runtime';

describe('Tempo data source', () => {
  it('parses json fields from backend', async () => {
    setupBackendSrv(
      new MutableDataFrame({
        fields: [
          { name: 'serviceTags', values: ['{"key":"servicetag1","value":"service"}'] },
          { name: 'logs', values: ['{"timestamp":12345,"fields":[{"key":"count","value":1}]}'] },
          { name: 'tags', values: ['{"key":"tag1","value":"val1"}'] },
          { name: 'serviceName', values: ['service'] },
        ],
      })
    );
    const ds = new TempoDatasource(defaultSettings);
    await expect(ds.query({ targets: [{ refId: 'refid1' }] } as any)).toEmitValuesWith((response) => {
      const fields = (response[0].data[0] as DataFrame).fields;
      expect(
        fields.map((f) => ({
          name: f.name,
          values: f.values.toArray(),
        }))
      ).toMatchObject([
        { name: 'serviceTags', values: [{ key: 'servicetag1', value: 'service' }] },
        { name: 'logs', values: [{ timestamp: 12345, fields: [{ key: 'count', value: 1 }] }] },
        { name: 'tags', values: [{ key: 'tag1', value: 'val1' }] },
        { name: 'serviceName', values: ['service'] },
      ]);
    });
  });
});

function setupBackendSrv(frame: DataFrame) {
  setBackendSrv({
    fetch(): Observable<FetchResponse<BackendDataSourceResponse>> {
      return of(
        createFetchResponse({
          results: {
            refid1: {
              frames: [dataFrameToJSON(frame)],
            },
          },
        })
      );
    },
  } as any);
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
