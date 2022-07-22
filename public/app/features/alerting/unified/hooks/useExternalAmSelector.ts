import { keyBy } from 'lodash';
import { useSelector } from 'react-redux';

import { DataSourceInstanceSettings } from '@grafana/data';
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

  const droppedAMUrls = new Set<string>();
  const activeAMUrls = new Set<string>();
  discoveredAlertmanagers?.droppedAlertManagers.forEach((am) => droppedAMUrls.add(am.url));
  discoveredAlertmanagers?.activeAlertManagers.forEach((am) => activeAMUrls.add(am.url));

  return externalDsAlertManagers.map((dsAm) => {
    const amUrl = alertmanagerDatasources[dsAm.uid]?.url;

    return {
      dataSource: dsAm,
      url: amUrl,
      status: amUrl
        ? droppedAMUrls.has(amUrl)
          ? 'dropped'
          : activeAMUrls.has(`${amUrl}/api/v2/alerts`)
          ? 'active'
          : 'pending'
        : 'pending',
    };
  });
}
