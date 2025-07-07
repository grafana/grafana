import { SelectableValue } from '@grafana/data';

import { AzureMonitorQuery, AzureQueryType, AzureTracesFilter, ResultFormat } from '../../types/query';

// Used when switching from a traces exemplar query to a standard Azure Traces query
export function setDefaultTracesQuery(query: AzureMonitorQuery): AzureMonitorQuery {
  return {
    ...query,
    query: undefined,
    queryType: AzureQueryType.AzureTraces,
    azureTraces: undefined,
  };
}

export function setQueryOperationId(query: AzureMonitorQuery, operationId?: string): AzureMonitorQuery {
  return {
    ...query,
    azureTraces: {
      ...query.azureTraces,
      operationId,
    },
  };
}

export function setFormatAs(query: AzureMonitorQuery, formatAs: ResultFormat): AzureMonitorQuery {
  return {
    ...query,
    azureTraces: {
      ...query.azureTraces,
      resultFormat: formatAs,
    },
  };
}

export function setTraceTypes(query: AzureMonitorQuery, traceTypes: string[]): AzureMonitorQuery {
  return {
    ...query,
    azureTraces: {
      ...query.azureTraces,
      traceTypes,
    },
  };
}

export function setFilters(query: AzureMonitorQuery, filters: AzureTracesFilter[]): AzureMonitorQuery {
  return {
    ...query,
    azureTraces: {
      ...query.azureTraces,
      filters,
    },
  };
}

export function onLoad(
  query: AzureMonitorQuery,
  defaultValue: ResultFormat,
  handleChange: (change: SelectableValue<ResultFormat>) => void
) {
  if (!query.azureTraces?.resultFormat) {
    handleChange({ value: defaultValue });
  }
}
