import { type DataSourceInstanceSettings, type DataSourceRef } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { resolveLegacyDatasourceNames } from './resolveLegacyDatasourceNames';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceSettings: jest.fn(),
}));

const promSettings = {
  uid: 'prom-uid',
  type: 'prometheus',
  apiVersion: 'v1',
  name: 'Prometheus',
} as DataSourceInstanceSettings;
const promRef = { uid: 'prom-uid', type: 'prometheus', apiVersion: 'v1' };

type Datasource = DataSourceRef | string | null | undefined;

describe('resolveLegacyDatasourceNames', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(getDataSourceInstanceSettings)
      .mockImplementation(async (ref) => (ref === 'Prometheus' ? promSettings : undefined));
  });

  it('resolves datasource names on panels, targets, nested row panels, variables and annotations', async () => {
    const dashboard = {
      schemaVersion: 36,
      panels: [
        { datasource: 'Prometheus' as Datasource, targets: [{ datasource: 'Prometheus' as Datasource }] },
        { type: 'row', panels: [{ datasource: 'Prometheus' as Datasource }] },
      ],
      templating: { list: [{ datasource: 'Prometheus' as Datasource }] },
      annotations: { list: [{ datasource: 'Prometheus' as Datasource }] },
    };

    await resolveLegacyDatasourceNames(dashboard);

    expect(dashboard.panels[0].datasource).toEqual(promRef);
    expect(dashboard.panels[0].targets?.[0].datasource).toEqual(promRef);
    expect(dashboard.panels[1].panels?.[0].datasource).toEqual(promRef);
    expect(dashboard.templating.list[0].datasource).toEqual(promRef);
    expect(dashboard.annotations.list[0].datasource).toEqual(promRef);
  });

  it('leaves refs, template variables and unknown names untouched', async () => {
    const existingRef = { uid: 'loki-uid', type: 'loki' };
    const dashboard = {
      schemaVersion: 36,
      panels: [
        { datasource: existingRef as Datasource },
        { datasource: '$ds' as Datasource },
        { datasource: '${ds}' as Datasource },
        { datasource: 'unknown' as Datasource },
        { datasource: null as Datasource },
      ],
    };

    await resolveLegacyDatasourceNames(dashboard);

    expect(dashboard.panels.map((p) => p.datasource)).toEqual([existingRef, '$ds', '${ds}', 'unknown', null]);
    expect(getDataSourceInstanceSettings).toHaveBeenCalledTimes(1);
    expect(getDataSourceInstanceSettings).toHaveBeenCalledWith('unknown');
  });

  it('leaves panels, targets and annotations that DashboardMigrator converts on older schema versions', async () => {
    const dashboard = {
      schemaVersion: 32,
      panels: [{ datasource: 'Prometheus' as Datasource, targets: [{ datasource: 'Prometheus' as Datasource }] }],
      templating: { list: [{ datasource: 'Prometheus' as Datasource }] },
      annotations: { list: [{ datasource: 'Prometheus' as Datasource }] },
    };

    await resolveLegacyDatasourceNames(dashboard);

    expect(dashboard.panels[0].datasource).toBe('Prometheus');
    expect(dashboard.panels[0].targets[0].datasource).toBe('Prometheus');
    expect(dashboard.annotations.list[0].datasource).toBe('Prometheus');
    expect(dashboard.templating.list[0].datasource).toEqual(promRef);
  });
});
