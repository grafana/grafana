import { lastValueFrom } from 'rxjs';
import { urlUtil } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import {
  AlertmanagerAlert,
  AlertManagerCortexConfig,
  AlertmanagerGroup,
  Silence,
  SilenceCreatePayload,
  Matcher,
  AlertmanagerStatus,
  Receiver,
  TestReceiversPayload,
  TestReceiversResult,
  TestReceiversAlert,
  ExternalAlertmanagersResponse,
} from 'app/plugins/datasource/alertmanager/types';
import { getDatasourceAPIId, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

// "grafana" for grafana-managed, otherwise a datasource name
export async function fetchAlertManagerConfig(alertManagerSourceName: string): Promise<AlertManagerCortexConfig> {
  try {
    const result = await lastValueFrom(
      getBackendSrv().fetch<AlertManagerCortexConfig>({
        url: `/api/alertmanager/${getDatasourceAPIId(alertManagerSourceName)}/config/api/v1/alerts`,
        showErrorAlert: false,
        showSuccessAlert: false,
      })
    );
    return {
      template_files: result.data.template_files ?? {},
      alertmanager_config: result.data.alertmanager_config ?? {},
    };
  } catch (e) {
    // if no config has been uploaded to grafana, it returns error instead of latest config
    if (
      alertManagerSourceName === GRAFANA_RULES_SOURCE_NAME &&
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
      url: `/api/alertmanager/${getDatasourceAPIId(alertManagerSourceName)}/config/api/v1/alerts`,
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
      url: `/api/alertmanager/${getDatasourceAPIId(alertManagerSourceName)}/config/api/v1/alerts`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );
}

export async function fetchSilences(alertManagerSourceName: string): Promise<Silence[]> {
  const result = await lastValueFrom(
    getBackendSrv().fetch<Silence[]>({
      url: `/api/alertmanager/${getDatasourceAPIId(alertManagerSourceName)}/api/v2/silences`,
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
      url: `/api/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/api/v2/silences`,
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
    `/api/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/api/v2/silence/${encodeURIComponent(silenceID)}`
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
        `/api/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/api/v2/alerts` +
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
      url: `/api/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/api/v2/alerts/groups`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );

  return result.data;
}

export async function fetchStatus(alertManagerSourceName: string): Promise<AlertmanagerStatus> {
  const result = await lastValueFrom(
    getBackendSrv().fetch<AlertmanagerStatus>({
      url: `/api/alertmanager/${getDatasourceAPIId(alertManagerSourceName)}/api/v2/status`,
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
  const result = await lastValueFrom(
    getBackendSrv().fetch<TestReceiversResult>({
      method: 'POST',
      data,
      url: `/api/alertmanager/${getDatasourceAPIId(alertManagerSourceName)}/config/api/v1/receivers/test`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );

  // api returns 207 if one or more receivers has failed test. Collect errors in this case
  if (result.status === 207) {
    throw new Error(
      result.data.receivers
        .flatMap((receiver) =>
          receiver.grafana_managed_receiver_configs
            .filter((receiver) => receiver.status === 'failed')
            .map((receiver) => receiver.error ?? 'Unknown error.')
        )
        .join('; ')
    );
  }
}

export async function addAlertManagers(alertManagers: string[]): Promise<void> {
  await lastValueFrom(
    getBackendSrv().fetch({
      method: 'POST',
      data: { alertmanagers: alertManagers },
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

export async function fetchExternalAlertmanagerConfig(): Promise<{ alertmanagers: string[] }> {
  const result = await lastValueFrom(
    getBackendSrv().fetch<{ alertmanagers: string[] }>({
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
