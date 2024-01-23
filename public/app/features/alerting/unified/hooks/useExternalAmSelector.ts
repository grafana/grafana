import { useEffect } from 'react';

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
  const [fetchDataSourceSettings, { alertmanagerDataSources }] =
    dataSourcesApi.endpoints.getDataSourceSettings.useLazyQuery({
      refetchOnReconnect: true,
      refetchOnFocus: true,
      selectFromResult: (result) => {
        const alertmanagerDataSources = result.currentData?.filter(isAlertmanagerDataSource) ?? [];
        return { ...result, alertmanagerDataSources };
      },
    });

  // we'll also fetch the configuration for which Alertmanagers we are forwarding Grafana-managed alerts too
  // @TODO use polling when we have one or more alertmanagers in pending state
  const [fetchActiveAlertmanagers, { currentData: externalAlertmanagers }] =
    alertmanagerApi.endpoints.getExternalAlertmanagers.useLazyQuery({
      refetchOnReconnect: true,
      refetchOnFocus: true,
    });

  useEffect(() => {
    fetchDataSourceSettings();
    fetchActiveAlertmanagers();
  }, [fetchActiveAlertmanagers, fetchDataSourceSettings]);

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
    externalAlertmanagers?.activeAlertManagers.filter((am) => {
      return isAlertmanagerMatchByURL(dataSourceSettings.url, am.url);
    }) ?? [];

  const isDropped =
    externalAlertmanagers?.droppedAlertManagers.filter((am) => {
      return isAlertmanagerMatchByURL(dataSourceSettings.url, am.url);
    }) ?? [];

  const isPending = isActive.length === 0 && isDropped.length === 0;

  let status: ConnectionStatus = 'unknown';
  if (isActive?.length === 1) {
    status = 'active';
  } else if (isDropped.length === 1) {
    status = 'dropped';
  } else if (isActive.length > 1) {
    // Multiple Alertmanagers of the same URL may exist (e.g. with different credentials)
    // Alertmanager response only contains URLs, so in case of duplication, we are not able
    // to distinguish which is which, resulting in an inconclusive status.
    status = 'inconclusive';
  } else if (isPending) {
    status = 'pending';
  }

  return status;
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
