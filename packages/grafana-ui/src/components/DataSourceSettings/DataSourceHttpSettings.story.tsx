import React from 'react';

import { DataSourceSettings } from '@grafana/data';

import { UseState } from '../../utils/storybook/UseState';

import { DataSourceHttpSettings } from './DataSourceHttpSettings';
import mdx from './DataSourceHttpSettings.mdx';

const settingsMock: DataSourceSettings<any, any> = {
  id: 4,
  orgId: 1,
  uid: 'x',
  name: 'gdev-influxdb',
  type: 'influxdb',
  typeName: 'Influxdb',
  typeLogoUrl: '',
  access: 'direct',
  url: 'http://localhost:8086',
  password: '',
  user: 'grafana',
  database: 'site',
  basicAuth: false,
  basicAuthUser: '',
  basicAuthPassword: '',
  withCredentials: false,
  isDefault: false,
  jsonData: {
    timeInterval: '15s',
    httpMode: 'GET',
    keepCookies: ['cookie1', 'cookie2'],
    serverName: '',
  },
  secureJsonData: {
    password: true,
  },
  secureJsonFields: {},
  readOnly: true,
};

export default {
  title: 'Data Source/DataSourceHttpSettings',
  component: DataSourceHttpSettings,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return (
    <UseState initialState={settingsMock} logState>
      {(dataSourceSettings, updateDataSourceSettings) => {
        return (
          <DataSourceHttpSettings
            defaultUrl="http://localhost:9999"
            dataSourceConfig={dataSourceSettings}
            onChange={updateDataSourceSettings}
            showAccessOptions={true}
          />
        );
      }}
    </UseState>
  );
};
