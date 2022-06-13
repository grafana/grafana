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
      break;
    case AzureQueryType.LogAnalytics:
      return {
        ...commonProps,
        complexity: target.azureLogAnalytics?.query?.match(/\|/g)?.length,
        format: target.azureLogAnalytics?.resultFormat,
      };
      break;

    case AzureQueryType.AzureResourceGraph:
      return {
        ...commonProps,
        complexity: target.azureResourceGraph?.query?.match(/\|/g)?.length,
      };
      break;
  }
  return commonProps;
};
