import { of } from 'rxjs';

import { DataSourceInstanceSettings, PluginType } from '@grafana/data/src';
import { FetchResponse, getBackendSrv, setBackendSrv } from '@grafana/runtime/src';

import { TemplateSrv } from '../../../../features/templating/template_srv';
import InfluxDatasource from '../datasource';
import { InfluxOptions, InfluxVersion } from '../types';

const getAdhocFiltersMock = jest.fn().mockImplementation(() => []);
const replaceMock = jest.fn().mockImplementation((a: string, ...rest: unknown[]) => a);

export const templateSrvStub = {
  getAdhocFilters: getAdhocFiltersMock,
  replace: replaceMock,
} as unknown as TemplateSrv;

export function mockBackendService(response: any) {
  const fetchMock = jest.fn().mockReturnValue(of(response as FetchResponse));
  const origBackendSrv = getBackendSrv();
  setBackendSrv({
    ...origBackendSrv,
    fetch: fetchMock,
  });
}

export function getMockDS(instanceSettings: DataSourceInstanceSettings<InfluxOptions>): InfluxDatasource {
  return new InfluxDatasource(instanceSettings, templateSrvStub);
}

export function getMockDSInstanceSettings(): DataSourceInstanceSettings<InfluxOptions> {
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
    jsonData: { version: InfluxVersion.InfluxQL, httpMode: 'POST', dbName: 'site' },
  };
}
