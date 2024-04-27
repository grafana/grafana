// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/features/datasources/__mocks__/dataSourcesMocks.ts
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
      name: 'gdev-prometheus',
      typeName: 'Prometheus',
      orgId: 1,
      readOnly: false,
      type: 'prometheus',
      typeLogoUrl: 'packages/grafana-prometheus/src/img/prometheus_logo.svg',
      url: '',
      user: '',
      secureJsonFields: {},
    },
    overrides
  );
