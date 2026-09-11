import { type SelectableValue } from '@grafana/data';

import { BuilderQueryEditorExpressionType, BuilderQueryEditorPropertyType, ResultFormat } from '../../dataquery.gen';
import { type AzureMonitorQuery } from '../../types/query';

import { type LogTier } from './utils';

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

export function setLogTier(query: AzureMonitorQuery, logTier: LogTier | undefined): AzureMonitorQuery {
  return {
    ...query,
    azureLogAnalytics: {
      ...query.azureLogAnalytics,
      basicLogsQuery: logTier !== undefined,
      logTier,
    },
  };
}

export function setLogTierAndClearQuery(query: AzureMonitorQuery, logTier: LogTier | undefined): AzureMonitorQuery {
  const updated = setLogTier(query, logTier);
  const builderQuery = updated.azureLogAnalytics?.builderQuery;

  return {
    ...updated,
    azureLogAnalytics: {
      ...updated.azureLogAnalytics,
      query: '',
      ...(builderQuery && {
        builderQuery: {
          ...builderQuery,
          from: {
            type: BuilderQueryEditorExpressionType.Property,
            property: { type: BuilderQueryEditorPropertyType.String, name: '' },
          },
        },
      }),
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
