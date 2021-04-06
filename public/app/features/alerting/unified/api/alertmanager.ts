import { getBackendSrv } from '@grafana/runtime';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { getDatasourceAPIId, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

// "grafana" for grafana-managed, otherwise a datasource name
export async function fetchAlertManagerConfig(alertmanagerSourceName: string): Promise<AlertManagerCortexConfig> {
  try {
    const result = await getBackendSrv()
      .fetch<AlertManagerCortexConfig>({
        url: `/api/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/config/api/v1/alerts`,
        showErrorAlert: false,
        showSuccessAlert: false,
      })
      .toPromise();
    return result.data;
  } catch (e) {
    // if no config has been uploaded to grafana, it returns error instead of latest config
    if (
      alertmanagerSourceName === GRAFANA_RULES_SOURCE_NAME &&
      e.data?.message?.includes('failed to get latest configuration')
    ) {
      return {
        template_files: {},
        alertmanager_config: {},
      };
    }
    throw e;
  }
}

export async function updateAlertmanagerConfig(
  alertmanagerSourceName: string,
  config: AlertManagerCortexConfig
): Promise<void> {
  await getBackendSrv().post(
    `/api/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/config/api/v1/alerts`,
    config
  );
}
