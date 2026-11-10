import { config } from '@grafana/runtime';

import { getAlertingDataSourceSettings } from './bootDataSettings';
import { DataSourceInstanceSettingsFactory } from './testSetup/DataSources';

function listItemOf({ uid, type, name, meta }: ReturnType<typeof DataSourceInstanceSettingsFactory.build>) {
  return { uid, type, name, meta };
}

describe('getAlertingDataSourceSettings', () => {
  it('returns the settings of the listed data source', () => {
    const prom = DataSourceInstanceSettingsFactory.build({ uid: 'prom', name: 'Prometheus' });
    // eslint-disable-next-line @grafana/no-config-datasources
    config.datasources = { Prometheus: prom };

    expect(getAlertingDataSourceSettings(listItemOf(prom))).toBe(prom);
  });

  it('returns undefined when no settings exist under the name', () => {
    // eslint-disable-next-line @grafana/no-config-datasources
    config.datasources = {};

    expect(getAlertingDataSourceSettings(listItemOf(DataSourceInstanceSettingsFactory.build()))).toBeUndefined();
  });

  it('returns undefined when the settings under the name belong to another uid', () => {
    const listed = DataSourceInstanceSettingsFactory.build({ uid: 'listed', name: 'Prometheus' });
    // eslint-disable-next-line @grafana/no-config-datasources
    config.datasources = { Prometheus: DataSourceInstanceSettingsFactory.build({ uid: 'other', name: 'Prometheus' }) };

    expect(getAlertingDataSourceSettings(listItemOf(listed))).toBeUndefined();
  });
});
