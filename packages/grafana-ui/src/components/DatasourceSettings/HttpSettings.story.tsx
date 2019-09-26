import React from 'react';
import { storiesOf } from '@storybook/react';
import { DatasourceHttpSettings } from './HttpSettings';
// import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { DataSourceSettings } from '../../types';
import { UseState } from '../../utils/storybook/UseState';

const settingsMock: DataSourceSettings<any, any> = {
  id: 4,
  orgId: 1,
  name: 'gdev-influxdb',
  type: 'influxdb',
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
  },
  secureJsonData: {
    password: true,
  },
  readOnly: true,
};

const HttpSettingsStories = storiesOf('UI/Datasource/HttpSettings', module);

HttpSettingsStories.add('default', () => {
  return (
    <UseState initialState={settingsMock} logState>
      {(datasourceSettings, updateDatasourceSettings) => {
        return (
          <DatasourceHttpSettings
            defaultUrl="http://localhost:9999"
            datasourceConfig={datasourceSettings}
            onChange={updateDatasourceSettings}
            showAccessOptions={true}
            onBasicAuthPasswordChange={() => {}}
            onBasicAuthPasswordReset={() => {}}
          />
        );
      }}
    </UseState>
  );
});
