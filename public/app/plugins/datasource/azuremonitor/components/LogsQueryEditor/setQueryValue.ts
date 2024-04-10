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

export function setDashboardTime(query: AzureMonitorQuery, dashboardTime: string): AzureMonitorQuery {
  return {
    ...query,
    azureLogAnalytics: {
      ...query.azureLogAnalytics,
      dashboardTime: dashboardTime === 'dashboard' ? true : false,
    },
  };
}

export function setTimeColumn(query: AzureMonitorQuery, timeColumn: string): AzureMonitorQuery {
  return {
    ...query,
    azureLogAnalytics: {
      ...query.azureLogAnalytics,
      timeColumn,
    },
  };
}

export function setBasicLogsQuery(query: AzureMonitorQuery, basicLogsQuery: boolean): AzureMonitorQuery {
  return {
    ...query,
    azureLogAnalytics: {
      ...query.azureLogAnalytics,
      basicLogsQuery,
    },
  };
}

export function setBasicLogsQueryAcknowledged(
  query: AzureMonitorQuery,
  basicLogsQueryAcknowledged: boolean
): AzureMonitorQuery {
  return {
    ...query,
    azureLogAnalytics: {
      ...query.azureLogAnalytics,
      basicLogsQueryAcknowledged,
    },
  };
}
