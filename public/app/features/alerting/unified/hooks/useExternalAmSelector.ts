import { countBy, keyBy } from 'lodash';
import { useSelector } from 'react-redux';

import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';

import { StoreState } from '../../../../types';
import { getAlertManagerDataSources } from '../utils/datasource';

import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

const SUFFIX_REGEX = /\/api\/v[1|2]\/alerts/i;
type AlertmanagerConfig = { url: string; status: string; actualUrl: string };

export function useExternalAmSelector(): AlertmanagerConfig[] | [] {
  const discoveredAlertmanagers = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertmanagers.discoveredAlertmanagers.result?.data
  );
  const alertmanagerConfig = useSelector(
    (state: StoreState) => state.unifiedAlerting.externalAlertmanagers.alertmanagerConfig.result?.alertmanagers
  );

  if (!discoveredAlertmanagers || !alertmanagerConfig) {
    return [];
  }

  const enabledAlertmanagers: AlertmanagerConfig[] = [];
  const droppedAlertmanagers: AlertmanagerConfig[] = discoveredAlertmanagers.droppedAlertManagers.map((am) => ({
    url: am.url.replace(SUFFIX_REGEX, ''),
    status: 'dropped',
    actualUrl: am.url,
  }));

  for (const url of alertmanagerConfig) {
    if (discoveredAlertmanagers.activeAlertManagers.length === 0) {
      enabledAlertmanagers.push({
        url: url,
        status: 'pending',
        actualUrl: '',
      });
    } else {
      const matchingActiveAM = discoveredAlertmanagers.activeAlertManagers.find(
        (am) => am.url === `${url}/api/v2/alerts`
      );
      matchingActiveAM
        ? enabledAlertmanagers.push({
            url: matchingActiveAM.url.replace(SUFFIX_REGEX, ''),
            status: 'active',
            actualUrl: matchingActiveAM.url,
          })
        : enabledAlertmanagers.push({
            url: url,
            status: 'pending',
            actualUrl: '',
          });
    }
  }

  return [...enabledAlertmanagers, ...droppedAlertmanagers];
}

export interface ExternalDataSourceAM {
  dataSource: DataSourceInstanceSettings<AlertManagerDataSourceJsonData>;
  url?: string;
  status: 'active' | 'pending' | 'dropped';
  statusInconclusive?: boolean;
}

export function useExternalDataSourceAlertmanagers(): ExternalDataSourceAM[] {
  const externalDsAlertManagers = getAlertManagerDataSources().filter((ds) => ds.jsonData.handleGrafanaManagedAlerts);

  const alertmanagerDatasources = useSelector((state: StoreState) =>
    keyBy(
      state.dataSources.dataSources.filter((ds) => ds.type === 'alertmanager'),
      (ds) => ds.uid
    )
  );

  const discoveredAlertmanagers = useUnifiedAlertingSelector(
    (state) => state.externalAlertmanagers.discoveredAlertmanagers.result?.data
  );

  const droppedAMUrls = countBy(discoveredAlertmanagers?.droppedAlertManagers, (x) => x.url);
  const activeAMUrls = countBy(discoveredAlertmanagers?.activeAlertManagers, (x) => x.url);

  return externalDsAlertManagers.map<ExternalDataSourceAM>((dsAm) => {
    const dsSettings = alertmanagerDatasources[dsAm.uid];

    if (!dsSettings) {
      return {
        dataSource: dsAm,
        status: 'pending',
      };
    }

    const amUrl = getDataSourceUrlWithProtocol(dsSettings);
    const amStatusUrl = `${amUrl}/api/v2/alerts`;

    const matchingDroppedUrls = droppedAMUrls[amStatusUrl] ?? 0;
    const matchingActiveUrls = activeAMUrls[amStatusUrl] ?? 0;

    const isDropped = matchingDroppedUrls > 0;
    const isActive = matchingActiveUrls > 0;

    // Multiple Alertmanagers of the same URL may exist (e.g. with different credentials)
    // Alertmanager response only contains URLs, so in case of duplication, we are not able
    // to distinguish which is which, resulting in an inconclusive status.
    const isStatusInconclusive = matchingDroppedUrls + matchingActiveUrls > 1;

    const status = isDropped ? 'dropped' : isActive ? 'active' : 'pending';

    return {
      dataSource: dsAm,
      url: dsSettings.url,
      status,
      statusInconclusive: isStatusInconclusive,
    };
  });
}

function getDataSourceUrlWithProtocol<T extends DataSourceJsonData>(dsSettings: DataSourceSettings<T>) {
  const hasProtocol = new RegExp('^[^:]*://').test(dsSettings.url);
  if (!hasProtocol) {
    return `http://${dsSettings.url}`; // Grafana append http protocol if there is no any
  }

  return dsSettings.url;
}
