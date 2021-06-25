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
} from 'app/plugins/datasource/alertmanager/types';
import { getDatasourceAPIId, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

// "grafana" for grafana-managed, otherwise a datasource name
export async function fetchAlertManagerConfig(alertManagerSourceName: string): Promise<AlertManagerCortexConfig> {
  try {
    const result = await getBackendSrv()
      .fetch<AlertManagerCortexConfig>({
        url: `/api/alertmanager/${getDatasourceAPIId(alertManagerSourceName)}/config/api/v1/alerts`,
        showErrorAlert: false,
        showSuccessAlert: false,
      })
      .toPromise();
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
  await getBackendSrv()
    .fetch({
      method: 'POST',
      url: `/api/alertmanager/${getDatasourceAPIId(alertManagerSourceName)}/config/api/v1/alerts`,
      data: config,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
    .toPromise();
}

export async function fetchSilences(alertManagerSourceName: string): Promise<Silence[]> {
  const result = await getBackendSrv()
    .fetch<Silence[]>({
      url: `/api/alertmanager/${getDatasourceAPIId(alertManagerSourceName)}/api/v2/silences`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
    .toPromise();
  return result.data;
}

// returns the new silence ID. Even in the case of an update, a new silence is created and the previous one expired.
export async function createOrUpdateSilence(
  alertmanagerSourceName: string,
  payload: SilenceCreatePayload
): Promise<Silence> {
  const result = await getBackendSrv()
    .fetch<Silence>({
      url: `/api/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/api/v2/silences`,
      data: payload,
      showErrorAlert: false,
      showSuccessAlert: false,
      method: 'POST',
    })
    .toPromise();
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

  const result = await getBackendSrv()
    .fetch<AlertmanagerAlert[]>({
      url:
        `/api/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/api/v2/alerts` +
        (filters ? '?' + filters : ''),
      showErrorAlert: false,
      showSuccessAlert: false,
    })
    .toPromise();

  return result.data;
}

export async function fetchAlertGroups(alertmanagerSourceName: string): Promise<AlertmanagerGroup[]> {
  const result = await getBackendSrv()
    .fetch<AlertmanagerGroup[]>({
      url: `/api/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/api/v2/alerts/groups`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
    .toPromise();

  return result.data;
}

export async function fetchStatus(alertManagerSourceName: string): Promise<AlertmanagerStatus> {
  const result = await getBackendSrv()
    .fetch<AlertmanagerStatus>({
      url: `/api/alertmanager/${getDatasourceAPIId(alertManagerSourceName)}/api/v2/status`,
      showErrorAlert: false,
      showSuccessAlert: false,
    })
    .toPromise();

  return result.data;
}

function escapeQuotes(value: string): string {
  return value.replace(/"/g, '\\"');
}
