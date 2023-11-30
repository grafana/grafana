import { merge } from 'lodash';

import { DataSourceJsonData, DataSourceSettings } from '@grafana/data';

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
