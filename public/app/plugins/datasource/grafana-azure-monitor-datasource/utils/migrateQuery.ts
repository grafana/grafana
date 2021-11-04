import { AzureMonitorQuery, AzureQueryType } from '../types';
import TimegrainConverter from '../time_grain_converter';
import {
  appendDimensionFilter,
  setTimeGrain as setMetricsTimeGrain,
} from '../components/MetricsQueryEditor/setQueryValue';
import { setKustoQuery } from '../components/LogsQueryEditor/setQueryValue';

const OLD_DEFAULT_DROPDOWN_VALUE = 'select';

export default function migrateQuery(query: AzureMonitorQuery): AzureMonitorQuery {
  let workingQuery = query;

  // The old angular controller also had a `migrateApplicationInsightsKeys` migraiton that
  // migrated old properties to other properties that still do not appear to be used anymore, so
  // we decided to not include that migration anymore
  // See https://github.com/grafana/grafana/blob/a6a09add/public/app/plugins/datasource/grafana-azure-monitor-datasource/query_ctrl.ts#L269-L288

  workingQuery = migrateTimeGrains(workingQuery);
  workingQuery = migrateLogAnalyticsToFromTimes(workingQuery);
  workingQuery = migrateToDefaultNamespace(workingQuery);
  workingQuery = migrateApplicationInsightsDimensions(workingQuery);
  workingQuery = migrateMetricsDimensionFilters(workingQuery);

  return workingQuery;
}

function migrateTimeGrains(query: AzureMonitorQuery): AzureMonitorQuery {
  let workingQuery = query;

  if (workingQuery.azureMonitor?.timeGrainUnit && workingQuery.azureMonitor.timeGrain !== 'auto') {
    const newTimeGrain = TimegrainConverter.createISO8601Duration(
      workingQuery.azureMonitor.timeGrain ?? 'auto',
      workingQuery.azureMonitor.timeGrainUnit
    );
    workingQuery = setMetricsTimeGrain(workingQuery, newTimeGrain);

    delete workingQuery.azureMonitor?.timeGrainUnit;
  }

  if (workingQuery.appInsights?.timeGrainUnit && workingQuery.appInsights.timeGrain !== 'auto') {
    const appInsights = {
      ...workingQuery.appInsights,
    };

    if (workingQuery.appInsights.timeGrainCount) {
      appInsights.timeGrain = TimegrainConverter.createISO8601Duration(
        workingQuery.appInsights.timeGrainCount,
        workingQuery.appInsights.timeGrainUnit
      );
    } else {
      appInsights.timeGrainCount = workingQuery.appInsights.timeGrain;

      if (workingQuery.appInsights.timeGrain) {
        appInsights.timeGrain = TimegrainConverter.createISO8601Duration(
          workingQuery.appInsights.timeGrain,
          workingQuery.appInsights.timeGrainUnit
        );
      }
    }

    workingQuery = {
      ...workingQuery,
      appInsights: appInsights,
    };
  }

  return workingQuery;
}

function migrateLogAnalyticsToFromTimes(query: AzureMonitorQuery): AzureMonitorQuery {
  let workingQuery = query;

  if (workingQuery.azureLogAnalytics?.query?.match(/\$__from\s/gi)) {
    workingQuery = setKustoQuery(
      workingQuery,
      workingQuery.azureLogAnalytics.query.replace(/\$__from\s/gi, '$__timeFrom() ')
    );
  }

  if (workingQuery.azureLogAnalytics?.query?.match(/\$__to\s/gi)) {
    workingQuery = setKustoQuery(
      workingQuery,
      workingQuery.azureLogAnalytics.query.replace(/\$__to\s/gi, '$__timeTo() ')
    );
  }

  return workingQuery;
}

function migrateToDefaultNamespace(query: AzureMonitorQuery): AzureMonitorQuery {
  const haveMetricNamespace =
    query.azureMonitor?.metricNamespace && query.azureMonitor.metricNamespace !== OLD_DEFAULT_DROPDOWN_VALUE;

  if (!haveMetricNamespace && query.azureMonitor?.metricDefinition) {
    return {
      ...query,
      azureMonitor: {
        ...query.azureMonitor,
        metricNamespace: query.azureMonitor.metricDefinition,
      },
    };
  }

  return query;
}

function migrateApplicationInsightsDimensions(query: AzureMonitorQuery): AzureMonitorQuery {
  const dimension = query?.appInsights?.dimension as unknown;

  if (dimension && typeof dimension === 'string') {
    return {
      ...query,
      appInsights: {
        ...query.appInsights,
        dimension: [dimension],
      },
    };
  }

  return query;
}

// Exported because its also used directly in the datasource.ts for some reason
function migrateMetricsDimensionFilters(query: AzureMonitorQuery): AzureMonitorQuery {
  let workingQuery = query;

  const oldDimension = workingQuery.azureMonitor?.dimension;
  if (oldDimension && oldDimension !== 'None') {
    workingQuery = appendDimensionFilter(workingQuery, oldDimension, 'eq', workingQuery.azureMonitor?.dimensionFilter);
  }

  return workingQuery;
}

// datasource.ts also contains some migrations, which have been moved to here. Unsure whether
// they should also do all the other migrations...
export function datasourceMigrations(query: AzureMonitorQuery): AzureMonitorQuery {
  let workingQuery = query;

  if (workingQuery.queryType === AzureQueryType.ApplicationInsights && workingQuery.appInsights?.rawQuery) {
    workingQuery = {
      ...workingQuery,
      queryType: AzureQueryType.InsightsAnalytics,
      appInsights: undefined,
      insightsAnalytics: {
        query: workingQuery.appInsights.rawQuery,
        resultFormat: 'time_series',
      },
    };
  }

  if (!workingQuery.queryType) {
    workingQuery = {
      ...workingQuery,
      queryType: AzureQueryType.AzureMonitor,
    };
  }

  if (workingQuery.queryType === AzureQueryType.AzureMonitor && workingQuery.azureMonitor) {
    workingQuery = migrateMetricsDimensionFilters(workingQuery);
  }

  return workingQuery;
}
