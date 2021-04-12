import { getBackendSrv } from '@grafana/runtime';
import {
  AlertmanagerAlert,
  AlertManagerCortexConfig,
  AlertmanagerGroup,
  Silence,
  SilenceCreatePayload,
  SilenceMatcher,
} from 'app/plugins/datasource/alertmanager/types';
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

export async function fetchSilences(alertmanagerSourceName: string): Promise<Silence[]> {
  const result = await getBackendSrv()
    .fetch<Silence[]>({
      url: `/api/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/api/v2/silences`,
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
): Promise<string> {
  const result = await getBackendSrv().post(
    `/api/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/api/v2/silences`,
    payload
  );
  return result.data.silenceID;
}

export async function expireSilence(alertmanagerSourceName: string, silenceID: string): Promise<void> {
  await getBackendSrv().delete(
    `/api/alertmanager/${getDatasourceAPIId(alertmanagerSourceName)}/api/v2/silences/${encodeURIComponent(silenceID)}`
  );
}

export async function fetchAlerts(
  alertmanagerSourceName: string,
  matchers?: SilenceMatcher[]
): Promise<AlertmanagerAlert[]> {
  const filters =
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

function escapeQuotes(value: string): string {
  return value.replace(/"/g, '\\"');
}
