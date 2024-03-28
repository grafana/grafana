import { produce } from 'immer';

import { DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';

import { alertingApi } from './alertingApi';

export const dataSourcesApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getAllDataSourceSettings: build.query<Array<DataSourceSettings<DataSourceJsonData>>, void>({
      query: () => ({ url: 'api/datasources' }),
      providesTags: (result) => {
        // we'll create individual cache entries for each datasource UID
        return result ? result.map(({ uid }) => ({ type: 'DataSourceSettings', id: uid })) : ['DataSourceSettings'];
      },
    }),
    getDataSourceSettingsForUID: build.query<DataSourceSettings<DataSourceJsonData>, string>({
      query: (uid) => ({ url: `api/datasources/uid/${uid}` }),
      providesTags: (_result, _error, uid) => [{ type: 'DataSourceSettings', id: uid }],
    }),
  }),
});

// I've split these up to get TypeScript type inference working properly when calling endpoints within endpoints
// I really don't like this
export const dataSourcesApiExtra = dataSourcesApi.injectEndpoints({
  endpoints: (build) => ({
    enableOrDisableHandlingGrafanaManagedAlerts: build.mutation<
      unknown,
      { uid: string; handleGrafanaManagedAlerts: boolean }
    >({
      queryFn: async ({ uid, handleGrafanaManagedAlerts }, queryApi, _extraOptions, baseQuery) => {
        // @TODO calling endpoint from another endpoint like this is a bit weird - refactor this?
        const fetchSettingsThunk = dataSourcesApi.endpoints.getDataSourceSettingsForUID.initiate(uid);
        const { data: existingSettings } = await queryApi.dispatch(fetchSettingsThunk);

        if (!existingSettings) {
          throw new Error(`Failed to fetch Alertmanager data source settings for uid "${uid}"`);
        }

        const newSettings = produce(
          existingSettings,
          (settings: DataSourceSettings<AlertManagerDataSourceJsonData>) => {
            settings.jsonData.handleGrafanaManagedAlerts = handleGrafanaManagedAlerts;
          }
        );

        return baseQuery({
          method: 'PUT',
          url: `api/datasources/uid/${uid}`,
          data: newSettings,
          showSuccessAlert: false,
        });
      },
      // we need to invalidate the settings for a single Datasource because otherwise the backend will complain
      // about it already having been edited by another user – edits are tracked with a version number
      invalidatesTags: (_result, _error, args) => [{ type: 'DataSourceSettings', id: args.uid }],
    }),
  }),
});
