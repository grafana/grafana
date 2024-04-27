import { DataSourceSettings } from '@grafana/data';
import { AlertManagerDataSourceJsonData, ExternalAlertmanagers } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { dataSourcesApi } from '../api/dataSourcesApi';
import { isAlertmanagerDataSource } from '../utils/datasource';

type ConnectionStatus = 'active' | 'pending' | 'dropped' | 'inconclusive' | 'uninterested' | 'unknown';

export interface ExternalAlertmanagerDataSourceWithStatus {
  dataSourceSettings: DataSourceSettings<AlertManagerDataSourceJsonData>;
  status: ConnectionStatus;
}

/**
 * Returns all configured Alertmanager data sources and their connection status with the internal ruler
 */
export function useExternalDataSourceAlertmanagers(): ExternalAlertmanagerDataSourceWithStatus[] {
  // firstly we'll fetch the settings for all datasources and filter for "alertmanager" type
  const { alertmanagerDataSources } = dataSourcesApi.endpoints.getAllDataSourceSettings.useQuery(undefined, {
    refetchOnReconnect: true,
    selectFromResult: (result) => {
      const alertmanagerDataSources = result.currentData?.filter(isAlertmanagerDataSource) ?? [];
      return { ...result, alertmanagerDataSources };
    },
  });

  // we'll also fetch the configuration for which Alertmanagers we are forwarding Grafana-managed alerts too
  // @TODO use polling when we have one or more alertmanagers in pending state
  const { currentData: externalAlertmanagers } = alertmanagerApi.endpoints.getExternalAlertmanagers.useQuery(
    undefined,
    { refetchOnReconnect: true }
  );

  if (!alertmanagerDataSources) {
    return [];
  }

  return alertmanagerDataSources.map<ExternalAlertmanagerDataSourceWithStatus>((dataSourceSettings) => {
    const status = externalAlertmanagers
      ? determineAlertmanagerConnectionStatus(externalAlertmanagers, dataSourceSettings)
      : 'unknown';

    return {
      dataSourceSettings,
      status,
    };
  });
}

// using the information from /api/v1/ngalert/alertmanagers we should derive the connection status of a single data source
function determineAlertmanagerConnectionStatus(
  externalAlertmanagers: ExternalAlertmanagers,
  dataSourceSettings: DataSourceSettings<AlertManagerDataSourceJsonData>
): ConnectionStatus {
  const isInterestedInAlerts = dataSourceSettings.jsonData.handleGrafanaManagedAlerts;
  if (!isInterestedInAlerts) {
    return 'uninterested';
  }

  const isActive =
    externalAlertmanagers?.activeAlertManagers.some((am) => {
      return isAlertmanagerMatchByURL(dataSourceSettings.url, am.url);
    }) ?? [];

  const isDropped =
    externalAlertmanagers?.droppedAlertManagers.some((am) => {
      return isAlertmanagerMatchByURL(dataSourceSettings.url, am.url);
    }) ?? [];

  // the Alertmanager is being adopted (pending) if it is interested in handling alerts but not in either "active" or "dropped"
  const isPending = !isActive && !isDropped;
  if (isPending) {
    return 'pending';
  }

  // Multiple Alertmanagers of the same URL may exist (e.g. with different credentials)
  // Alertmanager response only contains URLs, so when the URL exists in both active and dropped, we are not able
  // to distinguish which is which, resulting in an inconclusive status.
  const isInconclusive = isActive && isDropped;
  if (isInconclusive) {
    return 'inconclusive';
  }

  // if we get here, it's neither "uninterested", nor "inconclusive" nor "pending"
  if (isActive) {
    return 'active';
  } else if (isDropped) {
    return 'dropped';
  }

  return 'unknown';
}

// the vanilla Alertmanager and Mimir Alertmanager mount their API endpoints on different sub-paths
// Cortex also uses the same paths as Mimir
const MIMIR_ALERTMANAGER_PATH = '/alertmanager/api/v2/alerts';
const VANILLA_ALERTMANAGER_PATH = '/api/v2/alerts';

// when using the Mimir Alertmanager, those paths are mounted under "/alertmanager"
function isAlertmanagerMatchByURL(dataSourceUrl: string, alertmanagerUrl: string) {
  const normalizedUrl = normalizeDataSourceURL(dataSourceUrl);

  const prometheusAlertmanagerMatch = alertmanagerUrl === `${normalizedUrl}${VANILLA_ALERTMANAGER_PATH}`;
  const mimirAlertmanagerMatch = alertmanagerUrl === `${normalizedUrl}${MIMIR_ALERTMANAGER_PATH}`;

  return prometheusAlertmanagerMatch || mimirAlertmanagerMatch;
}

// Grafana prepends the http protocol if there isn't one, but it doesn't store that in the datasource settings
function normalizeDataSourceURL(url: string) {
  const hasProtocol = new RegExp('^[^:]*://').test(url);
  return hasProtocol ? url : `http://${url}`;
}
