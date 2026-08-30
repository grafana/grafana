import { lastValueFrom } from 'rxjs';

import { getBackendSrv, isFetchError } from '@grafana/runtime';
import { type AlertManagerCortexConfig, type AlertmanagerStatus } from 'app/plugins/datasource/alertmanager/types';

import { GRAFANA_RULES_SOURCE_NAME, getDatasourceAPIUid } from '../utils/datasource';

// "grafana" for grafana-managed, otherwise a datasource name
export async function fetchAlertManagerConfig(alertManagerSourceName: string): Promise<AlertManagerCortexConfig> {
  try {
    const result = await lastValueFrom(
      getBackendSrv().fetch<AlertManagerCortexConfig>({
        url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/alerts`,
        showErrorAlert: false,
        showSuccessAlert: false,
      })
    );
    return {
      template_files: result.data.template_files ?? {},
      template_file_provenances: result.data.template_file_provenances ?? {},
      alertmanager_config: result.data.alertmanager_config ?? {},
      last_applied: result.data.last_applied,
      id: result.data.id,
      extra_config: result.data.extra_config,
    };
  } catch (e) {
    // if no config has been uploaded to grafana, it returns error instead of latest config
    if (
      alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME &&
      isFetchError(e) &&
      e.data?.message?.includes('could not find an Alertmanager configuration')
    ) {
      return {
        template_files: {},
        alertmanager_config: {},
      };
    }
    throw e;
  }
}

export async function updateAlertManagerConfig(
  alertManagerSourceName: string,
  config: AlertManagerCortexConfig
): Promise<void> {
  await lastValueFrom(
    getBackendSrv().fetch({
      method: 'POST',
      url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/alerts`,
      data: config,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );
}

export async function deleteAlertManagerConfig(alertManagerSourceName: string): Promise<void> {
  await lastValueFrom(
    getBackendSrv().fetch({
      method: 'DELETE',
      url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/alerts`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );
}

export async function fetchStatus(alertManagerSourceName: string): Promise<AlertmanagerStatus> {
  const result = await lastValueFrom(
    getBackendSrv().fetch<AlertmanagerStatus>({
      url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/api/v2/status`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );

  return result.data;
}
