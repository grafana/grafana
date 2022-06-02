import { AzureMetricDimension, AzureMonitorQuery } from '../../types';

export function setResource(query: AzureMonitorQuery, resourceURI: string | undefined): AzureMonitorQuery {
  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      resourceUri: resourceURI,
      metricNamespace: undefined,
      metricName: undefined,
      aggregation: undefined,
      timeGrain: '',
      dimensionFilters: [],
    },
  };
}

export function setSubscriptionID(query: AzureMonitorQuery, subscriptionID: string): AzureMonitorQuery {
  if (query.subscription === subscriptionID) {
    return query;
  }

  return {
    ...query,
    subscription: subscriptionID,
    azureMonitor: {
      ...query.azureMonitor,
      resourceUri: '',
      resourceGroup: undefined,
      metricDefinition: undefined,
      metricNamespace: undefined,
      resourceName: undefined,
      metricName: undefined,
      aggregation: undefined,
      timeGrain: '',
      dimensionFilters: [],
    },
  };
}

export function setResourceGroup(query: AzureMonitorQuery, resourceGroup: string | undefined): AzureMonitorQuery {
  if (query.azureMonitor?.resourceGroup === resourceGroup) {
    return query;
  }

  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      resourceUri: '',
      resourceGroup: resourceGroup,
      metricDefinition: undefined,
      metricNamespace: undefined,
      resourceName: undefined,
      metricName: undefined,
      aggregation: undefined,
      timeGrain: '',
      dimensionFilters: [],
    },
  };
}

// In the query as "metricDefinition" for some reason
export function setResourceType(query: AzureMonitorQuery, resourceType: string | undefined): AzureMonitorQuery {
  if (query.azureMonitor?.metricDefinition === resourceType) {
    return query;
  }

  const newQuery = {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      resourceUri: '',
      metricDefinition: resourceType,
      resourceName: undefined,
      metricNamespace: undefined,
      metricName: undefined,
      aggregation: undefined,
      timeGrain: '',
      dimensionFilters: [],
    },
  };

  return newQuery;
}

export function setResourceName(query: AzureMonitorQuery, resourceName: string | undefined): AzureMonitorQuery {
  if (query.azureMonitor?.resourceName === resourceName) {
    return query;
  }

  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      resourceUri: '',
      resourceName: resourceName,
      metricNamespace: undefined,
      metricName: undefined,
      aggregation: undefined,
      timeGrain: '',
      dimensionFilters: [],
    },
  };
}

export function setMetricNamespace(query: AzureMonitorQuery, metricNamespace: string | undefined): AzureMonitorQuery {
  if (query.azureMonitor?.metricNamespace === metricNamespace) {
    return query;
  }

  let resourceUri = query.azureMonitor?.resourceUri;

  // Storage Account URIs need to be handled differently due to the additional storage services (blob/queue/table/file).
  // When one of these namespaces is selected it does not form a part of the URI for the storage account and so must be appended.
  // The 'default' path must also be appended. Without these two paths any API call will fail.
  if (resourceUri && metricNamespace?.includes('Microsoft.Storage/storageAccounts')) {
    const splitUri = resourceUri.split('/');
    const accountNameIndex = splitUri.findIndex((item) => item === 'storageAccounts') + 1;
    const baseUri = splitUri.slice(0, accountNameIndex + 1).join('/');
    if (metricNamespace === 'Microsoft.Storage/storageAccounts') {
      resourceUri = baseUri;
    } else {
      const subNamespace = metricNamespace.split('/')[2];
      resourceUri = `${baseUri}/${subNamespace}/default`;
    }
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
      resourceUri,
    },
  };
}

export function setMetricName(query: AzureMonitorQuery, metricName: string | undefined): AzureMonitorQuery {
  if (query.azureMonitor?.metricName === metricName) {
    return query;
  }

  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      metricName: metricName,
      aggregation: undefined,
      timeGrain: '',
      dimensionFilters: [],
    },
  };
}

export function setAggregation(query: AzureMonitorQuery, aggregation: string): AzureMonitorQuery {
  if (query.azureMonitor?.aggregation === aggregation) {
    return query;
  }

  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      aggregation: aggregation,
    },
  };
}

export function setTimeGrain(query: AzureMonitorQuery, timeGrain: string): AzureMonitorQuery {
  if (query.azureMonitor?.timeGrain === timeGrain) {
    return query;
  }

  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      timeGrain: timeGrain,
    },
  };
}

export function setDimensionFilters(query: AzureMonitorQuery, dimensions: AzureMetricDimension[]): AzureMonitorQuery {
  if (query.azureMonitor?.dimensionFilters === dimensions) {
    return query;
  }

  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      dimensionFilters: dimensions,
    },
  };
}

export function appendDimensionFilter(
  query: AzureMonitorQuery,
  dimension = '',
  operator = 'eq',
  filters: string[] = []
): AzureMonitorQuery {
  const existingFilters = query.azureMonitor?.dimensionFilters ?? [];

  return setDimensionFilters(query, [
    ...existingFilters,
    {
      dimension,
      operator,
      filters,
    },
  ]);
}

export function removeDimensionFilter(query: AzureMonitorQuery, indexToRemove: number): AzureMonitorQuery {
  const existingFilters = query.azureMonitor?.dimensionFilters ?? [];
  const newFilters = [...existingFilters];
  newFilters.splice(indexToRemove, 1);
  return setDimensionFilters(query, newFilters);
}

export function setDimensionFilterValue<Key extends keyof AzureMetricDimension>(
  query: AzureMonitorQuery,
  index: number,
  fieldName: Key,
  value: AzureMetricDimension[Key]
): AzureMonitorQuery {
  const existingFilters = query.azureMonitor?.dimensionFilters ?? [];
  const newFilters = [...existingFilters];
  const newFilter = newFilters[index];
  newFilter[fieldName] = value;
  if (fieldName === 'dimension' || fieldName === 'operator') {
    newFilter.filters = [];
  }
  return setDimensionFilters(query, newFilters);
}

export function setTop(query: AzureMonitorQuery, top: string): AzureMonitorQuery {
  if (query.azureMonitor?.top === top) {
    return query;
  }

  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      top: top,
    },
  };
}

export function setLegendAlias(query: AzureMonitorQuery, alias: string): AzureMonitorQuery {
  if (query.azureMonitor?.alias === alias) {
    return query;
  }

  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      alias: alias,
    },
  };
}
