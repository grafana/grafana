import { merge } from 'lodash';

import { DataSourceSettings, DataSourceJsonData } from '@grafana/data';

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

export const getMockDataSource = <T extends DataSourceJsonData>(
  overrides?: Partial<DataSourceSettings<T>>
): DataSourceSettings<T> =>
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
