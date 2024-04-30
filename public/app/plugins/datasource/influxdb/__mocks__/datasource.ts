import { of } from 'rxjs';

import { AdHocVariableFilter, DataSourceInstanceSettings, PluginType, ScopedVars } from '@grafana/data';
import { FetchResponse, getBackendSrv, setBackendSrv, VariableInterpolation } from '@grafana/runtime';

import { TemplateSrv } from '../../../../features/templating/template_srv';
import InfluxDatasource from '../datasource';
import { InfluxOptions, InfluxVersion } from '../types';

const getAdhocFiltersMock = jest.fn().mockImplementation(() => []);
const replaceMock = jest.fn().mockImplementation((a: string, ...rest: unknown[]) => a);

export const templateSrvStub = {
  getAdhocFilters: getAdhocFiltersMock,
  replace: replaceMock,
} as unknown as TemplateSrv;

export function mockTemplateSrv(
  getAdhocFiltersMock: (datasourceName: string) => AdHocVariableFilter[],
  replaceMock: (
    target?: string,
    scopedVars?: ScopedVars,
    format?: string | Function | undefined,
    interpolations?: VariableInterpolation[]
  ) => string
): TemplateSrv {
  return {
    getAdhocFilters: getAdhocFiltersMock,
    replace: replaceMock,
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
  templateSrv: TemplateSrv = templateSrvStub
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
