import { of } from 'rxjs';

import { DataSourceInstanceSettings, PluginType, ScopedVars } from '@grafana/data';
import { FetchResponse, getBackendSrv, setBackendSrv, TemplateSrv, VariableInterpolation } from '@grafana/runtime';

import InfluxDatasource from '../datasource';
import { InfluxOptions, InfluxVersion } from '../types';

export const replaceMock = jest.fn().mockImplementation((a: string, ...rest: unknown[]) => a);
export const templateSrvStub = mockTemplateSrv(replaceMock);
export function mockTemplateSrv(
  rm: (
    target?: string,
    scopedVars?: ScopedVars,
    format?: string | Function | undefined,
    interpolations?: VariableInterpolation[]
  ) => string = replaceMock
): TemplateSrv {
  return {
    replace: rm,
  } as unknown as TemplateSrv;
}

export function mockBackendService(response: FetchResponse) {
  const fetchMock = jest.fn().mockReturnValue(of(response));
  const origBackendSrv = getBackendSrv();
  setBackendSrv({
    ...origBackendSrv,
    fetch: fetchMock,
  });
  return fetchMock;
}

export function getMockInfluxDS(
  instanceSettings: DataSourceInstanceSettings<InfluxOptions> = getMockDSInstanceSettings(),
  templateSrv: TemplateSrv = mockTemplateSrv(replaceMock)
): InfluxDatasource {
  return new InfluxDatasource(instanceSettings, templateSrv);
}

export function getMockDSInstanceSettings(
  overrideJsonData?: Partial<InfluxOptions>
): DataSourceInstanceSettings<InfluxOptions> {
  return {
    id: 123,
    url: 'proxied',
    access: 'proxy',
    name: 'influxDb',
    readOnly: false,
    uid: 'influxdb-test',
    type: 'influxdb',
    meta: {
      id: 'influxdb-meta',
      type: PluginType.datasource,
      name: 'influxdb-test',
      info: {
        author: {
          name: 'observability-metrics',
        },
        version: 'v0.0.1',
        description: 'test',
        links: [],
        logos: {
          large: '',
          small: '',
        },
        updated: '',
        screenshots: [],
      },
      module: '',
      baseUrl: '',
    },
    jsonData: {
      version: InfluxVersion.InfluxQL,
      httpMode: 'POST',
      dbName: 'site',
      ...(overrideJsonData ? overrideJsonData : {}),
    },
  };
}
