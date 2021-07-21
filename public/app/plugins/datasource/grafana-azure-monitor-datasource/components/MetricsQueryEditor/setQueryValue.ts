import { AzureMetricDimension, AzureMonitorQuery } from '../../types';

const MAX_COMPONENT_LENGTH = 19;
function log(component: string, msg: string, ...rest: any[]) {
  const space = new Array(MAX_COMPONENT_LENGTH - component.length).fill(' ').join('');
  console.log(`%c[${component}]%c${space} ${msg}`, 'color: #3498db; font-weight: bold', 'color: #3498db;', ...rest);
}

export function setSubscriptionID(query: AzureMonitorQuery, subscriptionID: string): AzureMonitorQuery {
  log('setQueryID', 'setting subscriptionID', { subscriptionID });
  return {
    ...query,
    subscription: subscriptionID,
  };
}

export function setResourceGroup(query: AzureMonitorQuery, resourceGroupID: string | undefined): AzureMonitorQuery {
  log('setQueryID', 'setting resourceGroupID', { resourceGroupID });

  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      resourceGroup: resourceGroupID,
    },
  };
}

// In the query as "metricDefinition" for some reason
export function setResourceType(query: AzureMonitorQuery, resourceType: string | undefined): AzureMonitorQuery {
  log('setQueryID', 'setting resourceType', { resourceType });
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      metricDefinition: resourceType,
    },
  };
}

export function setResourceName(query: AzureMonitorQuery, resourceName: string | undefined): AzureMonitorQuery {
  log('setQueryID', 'setting resourceName', { resourceName });
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      resourceName: resourceName,
    },
  };
}

export function setMetricNamespace(query: AzureMonitorQuery, metricNamespace: string | undefined): AzureMonitorQuery {
  log('setQueryID', 'setting setMetricNamespace', { setMetricNamespace });
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      metricNamespace: metricNamespace,
    },
  };
}

export function setMetricName(query: AzureMonitorQuery, metricName: string | undefined): AzureMonitorQuery {
  log('setQueryID', 'setting setMetricName', { setMetricName });
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      metricName: metricName,
    },
  };
}

export function setAggregation(query: AzureMonitorQuery, aggregation: string): AzureMonitorQuery {
  log('setQueryID', 'setting setAggregation', { setAggregation });
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      aggregation: aggregation,
    },
  };
}

export function setTimeGrain(query: AzureMonitorQuery, timeGrain: string): AzureMonitorQuery {
  log('setQueryID', 'setting setTimeGrain', { setTimeGrain });
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      timeGrain: timeGrain,
    },
  };
}

export function setDimensionFilters(query: AzureMonitorQuery, dimensions: AzureMetricDimension[]): AzureMonitorQuery {
  log('setQueryID', 'setting setDimensionFilters', { setDimensionFilters });
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      dimensionFilters: dimensions,
    },
  };
}

export function setTop(query: AzureMonitorQuery, top: string): AzureMonitorQuery {
  log('setQueryID', 'setting setTop', { setTop });
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      top: top,
    },
  };
}

export function setLegendAlias(query: AzureMonitorQuery, alias: string): AzureMonitorQuery {
  log('setQueryID', 'setting setLegendAlias', { setLegendAlias });
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      alias: alias,
    },
  };
}
