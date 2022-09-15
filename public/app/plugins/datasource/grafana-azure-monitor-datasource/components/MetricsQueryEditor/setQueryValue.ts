import { AzureMetricDimension, AzureMonitorQuery } from '../../types';

export function setCustomNamespace(query: AzureMonitorQuery, selection: string | undefined): AzureMonitorQuery {
  if (query.azureMonitor?.customNamespace === selection) {
    return query;
  }
  const customNamespace = selection?.toLowerCase().startsWith('microsoft.storage/storageaccounts/') ? '' : selection;

  return {
    ...query,
    azureMonitor: {
      ...query.azureMonitor,
      customNamespace,
      metricName: undefined,
      aggregation: undefined,
      timeGrain: '',
      dimensionFilters: [],
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
