import { merge } from 'lodash';

import { DataSourceSettings, DataSourcePluginMeta } from '@grafana/data';
import { DataSourceSettingsState, PluginDashboard } from 'app/types';

export const getMockDashboard = (override?: Partial<PluginDashboard>) => ({
  uid: 'G1btqkgkK',
  pluginId: 'grafana-timestream-datasource',
  title: 'Sample (DevOps)',
  imported: true,
  importedUri: 'db/sample-devops',
  importedUrl: '/d/G1btqkgkK/sample-devops',
  slug: '',
  dashboardId: 12,
  folderId: 0,
  importedRevision: 1,
  revision: 1,
  description: '',
  path: 'dashboards/sample.json',
  removed: false,
  ...override,
});

export const getMockDataSources = (amount: number, overrides?: Partial<DataSourceSettings>): DataSourceSettings[] =>
  [...Array(amount)].map((_, i) =>
    getMockDataSource({
      ...overrides,
      id: i,
      uid: `uid-${i}`,
      database: overrides?.database ? `${overrides.database}-${i}` : `database-${i}`,
      name: overrides?.name ? `${overrides.name}-${i}` : `dataSource-${i}`,
    })
  );

export const getMockDataSource = <T>(overrides?: Partial<DataSourceSettings<T>>): DataSourceSettings<T> =>
  merge(
    {
      access: '',
      basicAuth: false,
      basicAuthUser: '',
      withCredentials: false,
      database: '',
      id: 13,
      uid: 'x',
      isDefault: false,
      jsonData: { authType: 'credentials', defaultRegion: 'eu-west-2' },
      name: 'gdev-cloudwatch',
      typeName: 'Cloudwatch',
      orgId: 1,
      readOnly: false,
      type: 'cloudwatch',
      typeLogoUrl: 'public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png',
      url: '',
      user: '',
      secureJsonFields: {},
    },
    overrides
  );

export const getMockDataSourceMeta = (overrides?: Partial<DataSourcePluginMeta>): DataSourcePluginMeta =>
  merge(
    {
      id: 0,
      name: 'datasource-test',
      type: 'datasource',
      info: {
        author: {
          name: 'Sample Author',
          url: 'https://sample-author.com',
        },
        description: 'Some sample description.',
        links: [{ name: 'Website', url: 'https://sample-author.com' }],
        logos: {
          large: 'large-logo',
          small: 'small-logo',
        },
        screenshots: [],
        updated: '2022-07-01',
        version: '1.5.0',
      },

      module: 'plugins/datasource-test/module',
      baseUrl: 'public/plugins/datasource-test',
    },
    overrides
  );

export const getMockDataSourceSettingsState = (overrides?: Partial<DataSourceSettingsState>): DataSourceSettingsState =>
  merge(
    {
      plugin: {
        meta: getMockDataSourceMeta(),
        components: {},
      },
      testingStatus: {},
      loadError: null,
      loading: false,
    },
    overrides
  );
