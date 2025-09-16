import { SelectableValue } from '@grafana/data';

import { AzureMonitorQuery, ResultFormat } from '../../types/query';

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
export function onLoad(
  query: AzureMonitorQuery,
  defaultValue: ResultFormat,
  handleChange: (change: SelectableValue<ResultFormat>) => void
) {
  if (!query.azureLogAnalytics) {
    handleChange({ value: defaultValue });
    return;
  }
  if (!query.azureLogAnalytics.resultFormat) {
    handleChange({ value: ResultFormat.TimeSeries });
  }
}
