import { produce } from 'immer';

import { DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';

import { alertingApi } from './alertingApi';

export const dataSourcesApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getAllDataSourceSettings: build.query<Array<DataSourceSettings<DataSourceJsonData>>, void>({
      query: () => ({ url: 'api/datasources' }),
      providesTags: ['DataSourceSettings'],
    }),
    getDataSourceSettings: build.query<DataSourceSettings<DataSourceJsonData>, string>({
      query: (uid) => ({ url: `api/datasources/uid/${uid}` }),
      providesTags: ['DataSourceSettings'],
    }),
  }),
});

// I've split these up to get TypeScript type inference working properly when calling endpoints within endpoints
dataSourcesApi.injectEndpoints({
  endpoints: (build) => ({
    updateAlertmanagerReceiveSetting: build.mutation<unknown, { uid: string; handleGrafanaManagedAlerts: boolean }>({
      queryFn: async ({ uid, handleGrafanaManagedAlerts }, queryApi, _extraOptions, fetchQuery) => {
        // @TODO calling endpoint from another endpoint like this is a bit weird - refactor this?
        const fetchSettingsThunk = dataSourcesApi.endpoints.getDataSourceSettings.initiate(uid);
        const { data: existingSettings } = await queryApi.dispatch(fetchSettingsThunk);

        if (!existingSettings) {
          throw new Error(`Failed to fetch Alertmanager data source settings for uid "${uid}"`);
        }

        const newSettings = produce(
          existingSettings,
          (settings: DataSourceSettings<AlertManagerDataSourceJsonData>) => {
            settings.jsonData = settings.jsonData ?? {};
            settings.jsonData.handleGrafanaManagedAlerts = handleGrafanaManagedAlerts;
          }
        );

        return fetchQuery({
          method: 'PUT',
          url: `api/datasources/uid/${uid}`,
          data: newSettings,
          showSuccessAlert: false,
        });
      },
      invalidatesTags: ['DataSourceSettings'],
    }),
  }),
});
