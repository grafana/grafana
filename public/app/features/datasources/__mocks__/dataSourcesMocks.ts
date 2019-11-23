import { DataSourceSettings } from '@grafana/data';

export const getMockDataSources = (amount: number) => {
  const dataSources = [];

  for (let i = 0; i <= amount; i++) {
    dataSources.push({
      access: '',
      basicAuth: false,
      database: `database-${i}`,
      id: i,
      isDefault: false,
      jsonData: { authType: 'credentials', defaultRegion: 'eu-west-2' },
      name: `dataSource-${i}`,
      orgId: 1,
      password: '',
      readOnly: false,
      type: 'cloudwatch',
      typeLogoUrl: 'public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png',
      url: '',
      user: '',
    });
  }

  return dataSources as DataSourceSettings[];
};

export const getMockDataSource = (): DataSourceSettings => {
  return {
    access: '',
    basicAuth: false,
    basicAuthUser: '',
    basicAuthPassword: '',
    withCredentials: false,
    database: '',
    id: 13,
    isDefault: false,
    jsonData: { authType: 'credentials', defaultRegion: 'eu-west-2' },
    name: 'gdev-cloudwatch',
    orgId: 1,
    password: '',
    readOnly: false,
    type: 'cloudwatch',
    typeLogoUrl: 'public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png',
    url: '',
    user: '',
  };
};
