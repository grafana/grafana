import { reportInteraction } from '@grafana/runtime';

import { AzureMonitorQuery, AzureQueryType } from '../types';

export const logAzureMonitorEvent = (target: AzureMonitorQuery, eventName: string) => {
  let typeSpecific;
  switch (target.queryType) {
    case AzureQueryType.AzureMonitor:
      typeSpecific = {
        dimensions: target.azureMonitor?.dimensionFilters?.length ?? 0,
        alias: !!target.azureMonitor?.alias,
        top: !!target.azureMonitor?.top,
      };
      break;
    case AzureQueryType.LogAnalytics:
      typeSpecific = {
        complexity: target.azureLogAnalytics?.query?.match(/\|/g)?.length,
        format: target.azureLogAnalytics?.resultFormat,
      };
      break;

    case AzureQueryType.AzureResourceGraph:
      typeSpecific = {
        complexity: target.azureResourceGraph?.query?.match(/\|/g)?.length,
      };
      break;
  }

  const event = {
    event: eventName,
    datasource: target.datasource?.type,
    hide: target.hide,
    queryType: target.queryType,
    ...typeSpecific,
  };

  console.log(event);
  reportInteraction(eventName, {
    datasource: target.datasource?.type,
    hide: target.hide,
    queryType: target.queryType,
    ...typeSpecific,
  });
};
