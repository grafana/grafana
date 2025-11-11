import { lastValueFrom } from 'rxjs';

import { isObject } from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import {
  AlertManagerCortexConfig,
  AlertmanagerGroup,
  AlertmanagerStatus,
  Receiver,
  TestReceiversAlert,
  TestReceiversPayload,
  TestReceiversResult,
} from 'app/plugins/datasource/alertmanager/types';

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

export async function fetchAlertGroups(alertmanagerSourceName: string): Promise<AlertmanagerGroup[]> {
  const result = await lastValueFrom(
    getBackendSrv().fetch<AlertmanagerGroup[]>({
      url: `/api/alertmanager/${getDatasourceAPIUid(alertmanagerSourceName)}/api/v2/alerts/groups`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );

  return result.data;
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

export async function testReceivers(
  alertManagerSourceName: string,
  receivers: Receiver[],
  alert?: TestReceiversAlert
): Promise<void> {
  const data: TestReceiversPayload = {
    receivers,
    alert,
  };
  try {
    const result = await lastValueFrom(
      getBackendSrv().fetch<TestReceiversResult>({
        method: 'POST',
        data,
        url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/config/api/v1/receivers/test`,
        showErrorAlert: false,
        showSuccessAlert: false,
      })
    );

    if (receiversResponseContainsErrors(result.data)) {
      throw new Error(getReceiverResultError(result.data));
    }
  } catch (error) {
    if (isFetchError(error) && isTestReceiversResult(error.data) && receiversResponseContainsErrors(error.data)) {
      throw new Error(getReceiverResultError(error.data));
    }

    throw error;
  }
}

function receiversResponseContainsErrors(result: TestReceiversResult) {
  return result.receivers.some((receiver) =>
    receiver.grafana_managed_receiver_configs.some((config) => config.status === 'failed')
  );
}

function isTestReceiversResult(data: unknown): data is TestReceiversResult {
  if (isObject(data) && 'receivers' in data && Array.isArray(data.receivers)) {
    return data.receivers.every(isSingleTestRecieverResult);
  }

  return false;
}

function isSingleTestRecieverResult(receiver: unknown): receiver is TestReceiversResult {
  return (
    isObject(receiver) &&
    'name' in receiver &&
    typeof receiver.name === 'string' &&
    'grafana_managed_receiver_configs' in receiver &&
    Array.isArray(receiver.grafana_managed_receiver_configs)
  );
}

function getReceiverResultError(receiversResult: TestReceiversResult) {
  return receiversResult.receivers
    .flatMap((receiver) =>
      receiver.grafana_managed_receiver_configs
        .filter((receiver) => receiver.status === 'failed')
        .map((receiver) => receiver.error ?? 'Unknown error.')
    )
    .join('; ');
}
