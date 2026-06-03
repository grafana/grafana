import { type DataSourcePluginMeta, type PluginMetaInfo, PluginType } from '@grafana/data';

import { isDataSourcePluginInstallable } from './utils';

const getPlugin = (overrides: Partial<DataSourcePluginMeta> = {}): DataSourcePluginMeta => ({
  id: 'grafana-athena-datasource',
  name: 'Amazon Athena',
  type: PluginType.datasource,
  module: '',
  baseUrl: '',
  info: {
    author: { name: 'Grafana Labs' },
    description: '',
    links: [],
    logos: { small: '', large: '' },
    screenshots: [],
    updated: '',
    version: '',
  },
  ...overrides,
});

describe('isDataSourcePluginInstallable', () => {
  it('returns true when the datasource plugin is disabled', () => {
    expect(isDataSourcePluginInstallable(getPlugin({ enabled: false }))).toBe(true);
  });

  it('returns true for phantom datasource plugins with add-plugin links', () => {
    expect(
      isDataSourcePluginInstallable(
        getPlugin({
          module: 'phantom',
          info: { links: [{ name: 'Add', url: '/plugins/add/grafana-athena-datasource' }] } as PluginMetaInfo,
        })
      )
    ).toBe(true);
  });

  it('returns false for already-enabled datasource plugins', () => {
    expect(isDataSourcePluginInstallable(getPlugin({ enabled: true }))).toBe(false);
  });
});
