import { DataSource, DataSourcePermission } from 'app/types';

export const getMockDataSources = (amount: number): DataSource[] => {
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

  return dataSources;
};

export const getMockDataSource = (): DataSource => {
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

export const getMockDataSourcePermissionsUser = (): DataSourcePermission => {
  return {
    created: '2018-10-10T16:50:45+02:00',
    datasourceId: 1,
    id: 2,
    permission: 1,
    permissionName: 'Query',
    updated: '2018-10-10T16:50:45+02:00',
    userAvatarUrl: '/avatar/926aa85c6bcefa0b4deca3223f337ae1',
    userEmail: 'test@test.com',
    userId: 3,
    userLogin: 'testUser',
  };
};

export const getMockDataSourcePermissionsTeam = (): DataSourcePermission => {
  return {
    created: '2018-10-10T16:57:09+02:00',
    datasourceId: 1,
    id: 6,
    permission: 1,
    permissionName: 'Query',
    team: 'A-team',
    teamAvatarUrl: '/avatar/93c0801b955cbd443a8cfa91a401d7bc',
    teamId: 1,
    updated: '2018-10-10T16:57:09+02:00',
  };
};
