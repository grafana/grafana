import { AzureMonitorQuery, AzureQueryType } from '../types';

export const getAzureMonitorEvent = (target: AzureMonitorQuery) => {
  const commonProps = {
    query_type: target.queryType,
  };
  switch (target.queryType) {
    case AzureQueryType.AzureMonitor:
      return {
        ...commonProps,
        dimensions: target.azureMonitor?.dimensionFilters?.length ?? 0,
        alias: !!target.azureMonitor?.alias,
        top: !!target.azureMonitor?.top,
      };
    case AzureQueryType.LogAnalytics:
      return {
        ...commonProps,
        format: target.azureLogAnalytics?.resultFormat,
      };
    default:
      return commonProps;
  }
};
