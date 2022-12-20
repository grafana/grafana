import { lastValueFrom } from 'rxjs';

import { urlUtil } from '@grafana/data';
import { getBackendSrv, isFetchError } from '@grafana/runtime';
import {
  AlertmanagerAlert,
  AlertManagerCortexConfig,
  AlertmanagerGroup,
  AlertmanagerStatus,
  ExternalAlertmanagerConfig,
  ExternalAlertmanagersResponse,
  Matcher,
  Receiver,
  Silence,
  SilenceCreatePayload,
  TestReceiversAlert,
  TestReceiversPayload,
  TestReceiversResult,
} from 'app/plugins/datasource/alertmanager/types';

import { getDatasourceAPIUid, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

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
      successfully_applied_at: result.data.successfully_applied_at,
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

export async function fetchSilences(alertManagerSourceName: string): Promise<Silence[]> {
  const result = await lastValueFrom(
    getBackendSrv().fetch<Silence[]>({
      url: `/api/alertmanager/${getDatasourceAPIUid(alertManagerSourceName)}/api/v2/silences`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );
  return result.data;
}

// returns the new silence ID. Even in the case of an update, a new silence is created and the previous one expired.
export async function createOrUpdateSilence(
  alertmanagerSourceName: string,
  payload: SilenceCreatePayload
): Promise<Silence> {
  const result = await lastValueFrom(
    getBackendSrv().fetch<Silence>({
      url: `/api/alertmanager/${getDatasourceAPIUid(alertmanagerSourceName)}/api/v2/silences`,
      data: payload,
      showErrorAlert: false,
      showSuccessAlert: false,
      method: 'POST',
    })
  );
  return result.data;
}

export async function expireSilence(alertmanagerSourceName: string, silenceID: string): Promise<void> {
  await getBackendSrv().delete(
    `/api/alertmanager/${getDatasourceAPIUid(alertmanagerSourceName)}/api/v2/silence/${encodeURIComponent(silenceID)}`
  );
}

export async function fetchAlerts(
  alertmanagerSourceName: string,
  matchers?: Matcher[],
  silenced = true,
  active = true,
  inhibited = true
): Promise<AlertmanagerAlert[]> {
  const filters =
    urlUtil.toUrlParams({ silenced, active, inhibited }) +
      matchers
        ?.map(
          (matcher) =>
            `filter=${encodeURIComponent(
              `${escapeQuotes(matcher.name)}=${matcher.isRegex ? '~' : ''}"${escapeQuotes(matcher.value)}"`
            )}`
        )
        .join('&') || '';

  const result = await lastValueFrom(
    getBackendSrv().fetch<AlertmanagerAlert[]>({
      url:
        `/api/alertmanager/${getDatasourceAPIUid(alertmanagerSourceName)}/api/v2/alerts` +
        (filters ? '?' + filters : ''),
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );

  return result.data;
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

function isTestReceiversResult(data: any): data is TestReceiversResult {
  const receivers = data?.receivers;

  if (Array.isArray(receivers)) {
    return receivers.every(
      (receiver: any) => typeof receiver.name === 'string' && Array.isArray(receiver.grafana_managed_receiver_configs)
    );
  }

  return false;
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

export async function addAlertManagers(alertManagerConfig: ExternalAlertmanagerConfig): Promise<void> {
  await lastValueFrom(
    getBackendSrv().fetch({
      method: 'POST',
      data: alertManagerConfig,
      url: '/api/v1/ngalert/admin_config',
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  ).then(() => {
    fetchExternalAlertmanagerConfig();
  });
}

export async function fetchExternalAlertmanagers(): Promise<ExternalAlertmanagersResponse> {
  const result = await lastValueFrom(
    getBackendSrv().fetch<ExternalAlertmanagersResponse>({
      method: 'GET',
      url: '/api/v1/ngalert/alertmanagers',
    })
  );

  return result.data;
}

export async function fetchExternalAlertmanagerConfig(): Promise<ExternalAlertmanagerConfig> {
  const result = await lastValueFrom(
    getBackendSrv().fetch<ExternalAlertmanagerConfig>({
      method: 'GET',
      url: '/api/v1/ngalert/admin_config',
      showErrorAlert: false,
    })
  );

  return result.data;
}

function escapeQuotes(value: string): string {
  return value.replace(/"/g, '\\"');
}
