import { countBy, keyBy } from 'lodash';

import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';
import { useSelector } from 'app/types';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { getAlertManagerDataSources } from '../utils/datasource';

export interface ExternalDataSourceAM {
  dataSource: DataSourceInstanceSettings<AlertManagerDataSourceJsonData>;
  url?: string;
  status: 'active' | 'pending' | 'dropped';
  statusInconclusive?: boolean;
}

export function useExternalDataSourceAlertmanagers(): ExternalDataSourceAM[] {
  const { useGetExternalAlertmanagersQuery } = alertmanagerApi;
  const { currentData: discoveredAlertmanagers } = useGetExternalAlertmanagersQuery();

  const externalDsAlertManagers = getAlertManagerDataSources().filter((ds) => ds.jsonData.handleGrafanaManagedAlerts);

  const alertmanagerDatasources = useSelector((state) =>
    keyBy(
      state.dataSources.dataSources.filter((ds) => ds.type === 'alertmanager'),
      (ds) => ds.uid
    )
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
