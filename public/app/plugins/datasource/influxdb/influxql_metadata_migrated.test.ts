import { of } from 'rxjs';

import { DataSourceInstanceSettings, PluginType } from '@grafana/data/src';
import { FetchResponse, getBackendSrv, setBackendSrv } from '@grafana/runtime/src';

import InfluxDatasource from './datasource';
import { runMetadataQuery } from './influxql_metadata_migrated';
import { templateSrvStub } from './specs/mocks';
import { InfluxOptions, InfluxVersion } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
}));

describe('influxql-metadata-migrated', () => {
  const instanceSettings = getDSInstanceSettings();
  const datasource: InfluxDatasource = new InfluxDatasource(instanceSettings, templateSrvStub);
  const origBackendSrv = getBackendSrv();

  afterEach(() => {
    setBackendSrv(origBackendSrv);
  });

  it('should get all retention policies', async () => {
    const response = {
      data: {
        results: {
          metadataQuery: {
            status: 200,
            frames: [
              {
                schema: {
                  refId: 'metadataQuery',
                  fields: [{ name: 'value', type: 'string', typeInfo: { frame: 'string' } }],
                },
                data: { values: [['autogen', 'bar', '5m_avg', '1m_avg']] },
              },
            ],
          },
        },
      },
    };
    const fetchMock = jest.fn().mockReturnValue(of(response as FetchResponse));
    setBackendSrv({
      ...origBackendSrv,
      fetch: fetchMock,
    });
    const rp = await runMetadataQuery({ type: 'RETENTION_POLICIES', datasource });
    console.log(rp);
    expect(fetchMock).toBeCalled();
    expect(rp.length).toBeGreaterThan(0);
  });
});

function getDSInstanceSettings(): DataSourceInstanceSettings<InfluxOptions> {
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
    jsonData: { version: InfluxVersion.InfluxQL, httpMode: 'POST' },
  };
}
