import { AzureMonitorQuery } from '../../types';

export function setMetricNamespace(query: AzureMonitorQuery, metricNamespace: string | undefined): AzureMonitorQuery {
  if (query.azureMonitor?.metricNamespace === metricNamespace) {
    return query;
  }

  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      metricNamespace: metricNamespace,
      metricName: undefined,
      aggregation: undefined,
      timeGrain: '',
      dimensionFilters: [],
    },
  };
}

export function setResource(query: AzureMonitorQuery, resourceURI: string | undefined): AzureMonitorQuery {
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      resourceUri: resourceURI,
    },
  };
}
