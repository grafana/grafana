import { produce } from 'immer';

import { dataSourcesApi } from '../../api/dataSourcesApi';
import { isAlertmanagerDataSource } from '../../utils/datasource';

export const useEnableOrDisableHandlingGrafanaManagedAlerts = () => {
  const [getSettings, getSettingsState] = dataSourcesApi.endpoints.getDataSourceSettingsForUID.useLazyQuery();
  const [updateSettings, updateSettingsState] = dataSourcesApi.endpoints.updateDataSourceSettingsForUID.useMutation();

  const enableOrDisable = async (uid: string, handleGrafanaManagedAlerts: boolean) => {
    const existingSettings = await getSettings(uid).unwrap();
    if (!isAlertmanagerDataSource(existingSettings)) {
      throw new Error(`Data source with UID ${uid} is not an Alertmanager data source`);
    }

    const newSettings = produce(existingSettings, (draft) => {
      draft.jsonData.handleGrafanaManagedAlerts = handleGrafanaManagedAlerts;
    });

    updateSettings({ uid, settings: newSettings });
  };

  const enable = (uid: string) => enableOrDisable(uid, true);
  const disable = (uid: string) => enableOrDisable(uid, false);

  const loadingState = {
    isLoading: getSettingsState.isLoading || updateSettingsState.isLoading,
    isError: getSettingsState.isError || updateSettingsState.isError,
    error: getSettingsState.error || updateSettingsState.error,
    data: updateSettingsState.data,
  };

  return [enable, disable, loadingState] as const;
};
