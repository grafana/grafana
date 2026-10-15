import { type DataSourceJsonData } from '@grafana/data';
import { config } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

import { getDataSourcesWithValidRecordingTarget } from './narrowings';
import { DataSourceInstanceSettingsFactory, setupDataSources } from './testSetup/DataSources';

jest.mock('@grafana/runtime/unstable', () => {
  const actual = jest.requireActual('@grafana/runtime/unstable');
  return {
    ...actual,
    getDataSourceInstanceList: jest.fn(actual.getDataSourceInstanceList),
  };
});

const runtime = jest.requireActual('@grafana/runtime/unstable');
const listMock = jest.mocked(getDataSourceInstanceList);

function dataSource(uid: string, type = 'prometheus', jsonData: DataSourceJsonData = {}) {
  return DataSourceInstanceSettingsFactory.build({ uid, name: uid, type, jsonData });
}

const grafanaBuiltIn = DataSourceInstanceSettingsFactory.build({
  uid: 'grafana',
  name: '-- Grafana --',
  type: 'grafana',
  meta: { ...DataSourceInstanceSettingsFactory.build().meta, id: 'grafana', builtIn: true },
});

afterEach(() => {
  jest.clearAllMocks();
  listMock.mockImplementation(runtime.getDataSourceInstanceList);
});

describe('getDataSourcesWithValidRecordingTarget', () => {
  it('includes Prometheus-flavored data sources unless they opt out', async () => {
    setupDataSources(
      dataSource('unset'),
      dataSource('allowed', 'prometheus', { allowAsRecordingRulesTarget: true }),
      dataSource('opted-out', 'prometheus', { allowAsRecordingRulesTarget: false }),
      dataSource('amazon', 'grafana-amazonprometheus-datasource'),
      dataSource('azure', 'grafana-azureprometheus-datasource')
    );

    const targets = await getDataSourcesWithValidRecordingTarget();

    expect(targets.map((ds) => ds.uid).sort()).toEqual(['allowed', 'amazon', 'azure', 'unset']);
  });

  it('excludes the built-in Grafana data source that the list appends to type-filtered results', async () => {
    setupDataSources(dataSource('prom'), dataSource('loki', 'loki'), grafanaBuiltIn);

    const targets = await getDataSourcesWithValidRecordingTarget();

    expect(targets.map((ds) => ds.uid)).toEqual(['prom']);
  });

  it('queries every instance of the supported types, not only those with query capabilities', async () => {
    setupDataSources(dataSource('prom'));

    await getDataSourcesWithValidRecordingTarget();

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: ['prometheus', 'grafana-amazonprometheus-datasource', 'grafana-azureprometheus-datasource'],
        all: true,
      })
    );
  });

  it('drops a data source whose settings cannot be found instead of assuming it allows recording rules', async () => {
    setupDataSources(dataSource('healthy'), dataSource('missing'));
    // eslint-disable-next-line @grafana/no-config-datasources
    delete config.datasources.missing;

    const targets = await getDataSourcesWithValidRecordingTarget();

    expect(targets.map((ds) => ds.uid)).toEqual(['healthy']);
  });

  it('rejects when the data source list cannot be read', async () => {
    listMock.mockRejectedValue(new Error('list request failed'));

    await expect(getDataSourcesWithValidRecordingTarget()).rejects.toThrow('list request failed');
  });
});
