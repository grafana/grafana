import { AzureMonitorQuery, ResultFormat } from '../../types';

export function setKustoQuery(query: AzureMonitorQuery, kustoQuery: string): AzureMonitorQuery {
  return {
    ...query,
    azureLogAnalytics: {
      ...query.azureLogAnalytics,
      query: kustoQuery,
    },
  };
}

export function setFormatAs(query: AzureMonitorQuery, formatAs: ResultFormat): AzureMonitorQuery {
  return {
    ...query,
    azureLogAnalytics: {
      ...query.azureLogAnalytics,
      resultFormat: formatAs,
    },
  };
}
