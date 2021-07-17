import { DataSourceSettings } from '@grafana/data';

export const getMockDataSources = (amount: number, props?: Partial<DataSourceSettings>) => {
  const dataSources: DataSourceSettings[] = [];

  for (let i = 0; i < amount; i++) {
    dataSources.push({
      uid: `uid${i}`,
      access: '',
      basicAuth: false,
      basicAuthUser: '',
      basicAuthPassword: '',
      withCredentials: false,
      database: `database-${i}`,
      id: i,
      isDefault: false,
      jsonData: { authType: 'credentials', defaultRegion: 'eu-west-2' },
      name: `dataSource-${i}`,
      orgId: 1,
      password: '',
      readOnly: false,
      typeName: 'Cloudwatch',
      type: 'cloudwatch',
      typeLogoUrl: 'public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png',
      url: '',
      user: '',
      secureJsonFields: {},
      ...props,
    });
  }

  return dataSources;
};

export const getMockDataSource = () => getMockDataSources(1)[0];
