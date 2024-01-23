import { DataSourceJsonData, DataSourceSettings } from '@grafana/data';

import { alertingApi } from './alertingApi';

export const dataSourcesApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getDataSourceSettings: build.query<Array<DataSourceSettings<DataSourceJsonData>>, void>({
      query: () => ({ url: 'api/datasources' }),
    }),
  }),
});
