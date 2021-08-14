import { AzureMonitorQuery } from '../../types';

export function setKustoQuery(query: AzureMonitorQuery, kustoQuery: string): AzureMonitorQuery {
  return {
    ...query,
    azureLogAnalytics: {
      ...query.azureLogAnalytics,
      query: kustoQuery,
    },
  };
}

export function setFormatAs(query: AzureMonitorQuery, formatAs: string): AzureMonitorQuery {
  return {
    ...query,
    azureLogAnalytics: {
      ...query.azureLogAnalytics,
      resultFormat: formatAs,
    },
  };
}

export function setResource(query: AzureMonitorQuery, resourceURI: string | undefined): AzureMonitorQuery {
  return {
    ...query,
    azureLogAnalytics: {
      ...query.azureLogAnalytics,
      resource: resourceURI,
    },
  };
}
