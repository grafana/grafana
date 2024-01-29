import { DataSourceJsonData, DataSourceSettings } from '@grafana/data';

import { alertingApi } from './alertingApi';

export const dataSourcesApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getAllDataSourceSettings: build.query<Array<DataSourceSettings<DataSourceJsonData>>, void>({
      query: () => ({ url: 'api/datasources' }),
      // we'll create individual cache entries for each datasource UID
      providesTags: (result) => {
        return result ? result.map(({ uid }) => ({ type: 'DataSourceSettings', id: uid })) : ['DataSourceSettings'];
      },
    }),
  }),
});
