import { AzureMonitorQuery, ResultFormat } from '../../types';

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
