import React from 'react';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { CustomHeadersSettings } from './CustomHeadersSettings';
import { DataSourceSettings } from '@grafana/data';

export default {
  title: 'Panel/DataSource/CustomHeadersSettings',
  component: CustomHeadersSettings,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
};

export const simple = () => {
  const dataSourceConfig: DataSourceSettings<any, any> = {
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
      httpHeaderName1: 'X-Custom-Header',
    },
    secureJsonData: {
      password: true,
      httpHeaderValue1: 'X-Custom-Header',
    },
    secureJsonFields: {
      httpHeaderValue1: true,
    },
    readOnly: true,
  };

  return <CustomHeadersSettings dataSourceConfig={dataSourceConfig} onChange={() => {}} />;
};
