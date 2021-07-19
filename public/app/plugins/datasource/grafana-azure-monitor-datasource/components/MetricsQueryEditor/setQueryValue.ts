import { AzureMetricDimension, AzureMonitorQuery } from '../../types';

export function setSubscriptionId(query: AzureMonitorQuery, subscriptionId: string): AzureMonitorQuery {
  return {
    ...query,
    subscription: subscriptionId,
  };
}

export function setResourceGroup(query: AzureMonitorQuery, resourceGroupId: string | undefined): AzureMonitorQuery {
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      resourceGroup: resourceGroupId,
    },
  };
}

// In the query as "metricDefinition" for some reason
export function setResourceType(query: AzureMonitorQuery, resourceType: string): AzureMonitorQuery {
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      metricDefinition: resourceType,
    },
  };
}

export function setResourceName(query: AzureMonitorQuery, resourceName: string | undefined): AzureMonitorQuery {
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      resourceName: resourceName,
    },
  };
}

export function setMetricNamespace(query: AzureMonitorQuery, metricNamespace: string): AzureMonitorQuery {
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      metricNamespace: metricNamespace,
    },
  };
}

export function setMetricName(query: AzureMonitorQuery, metricName: string): AzureMonitorQuery {
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      metricName: metricName,
    },
  };
}

export function setAggregation(query: AzureMonitorQuery, aggregation: string): AzureMonitorQuery {
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      aggregation: aggregation,
    },
  };
}

export function setTimeGrain(query: AzureMonitorQuery, timeGrain: string): AzureMonitorQuery {
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      timeGrain: timeGrain,
    },
  };
}

export function setDimensionFilters(query: AzureMonitorQuery, dimensions: AzureMetricDimension[]): AzureMonitorQuery {
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      dimensionFilters: dimensions,
    },
  };
}

export function setTop(query: AzureMonitorQuery, top: string): AzureMonitorQuery {
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      top: top,
    },
  };
}

export function setLegendAlias(query: AzureMonitorQuery, alias: string): AzureMonitorQuery {
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      alias: alias,
    },
  };
}
