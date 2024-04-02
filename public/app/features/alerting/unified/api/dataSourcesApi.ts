import { produce } from 'immer';

import { DataSourceSettings } from '@grafana/data';

import { isAlertmanagerDataSource } from '../utils/datasource';

import { alertingApi } from './alertingApi';

export const dataSourcesApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    getAllDataSourceSettings: build.query<DataSourceSettings[], void>({
      query: () => ({ url: 'api/datasources' }),
      // we'll create individual cache entries for each datasource UID
      providesTags: (result) => {
        return result ? result.map(({ uid }) => ({ type: 'DataSourceSettings', id: uid })) : ['DataSourceSettings'];
      },
    }),
    getDataSourceSettingsForUID: build.query<DataSourceSettings, string>({
      query: (uid) => ({ url: `api/datasources/uid/${uid}` }),
      providesTags: (_result, _error, uid) => [{ type: 'DataSourceSettings', id: uid }],
    }),
    updateDataSourceSettingsForUID: build.mutation<unknown, { uid: string; settings: DataSourceSettings }>({
      query: ({ uid, settings }) => ({
        url: `api/datasources/uid/${uid}`,
        method: 'PUT',
        data: settings,
        showSuccessAlert: false,
      }),
      // we need to invalidate the settings for a single Datasource because otherwise the backend will complain
      // about it already having been edited by another user – edits are tracked with a version number
      invalidatesTags: (_result, _error, args) => [{ type: 'DataSourceSettings', id: args.uid }],
    }),
  }),
});

type EnableOrDisableFunction = (uid: string, handleGrafanaManagedAlerts: boolean) => void;
type LoadingState = { isLoading: boolean; isError: boolean; error: unknown; data: unknown };

export const enableOrDisableHandlingGrafanaManagedAlerts = (): [EnableOrDisableFunction, LoadingState] => {
  const [getSettings, getSettingsState] = dataSourcesApi.endpoints.getDataSourceSettingsForUID.useLazyQuery();
  const [updateSettings, updateSettingsState] = dataSourcesApi.endpoints.updateDataSourceSettingsForUID.useMutation();

  const enableOrDisable: EnableOrDisableFunction = async (uid, handleGrafanaManagedAlerts) => {
    const existingSettings = await getSettings(uid).unwrap();
    if (!isAlertmanagerDataSource(existingSettings)) {
      throw new Error(`Data source with UID ${uid} is not an Alertmanager data source`);
    }

    const newSettings = produce(existingSettings, (draft) => {
      draft.jsonData.handleGrafanaManagedAlerts = handleGrafanaManagedAlerts;
    });

    updateSettings({ uid, settings: newSettings });
  };

  const loadingState: LoadingState = {
    isLoading: getSettingsState.isLoading || updateSettingsState.isLoading,
    isError: getSettingsState.isError || updateSettingsState.isError,
    error: getSettingsState.error || updateSettingsState.error,
    data: updateSettingsState.data,
  };

  return [enableOrDisable, loadingState];
};
