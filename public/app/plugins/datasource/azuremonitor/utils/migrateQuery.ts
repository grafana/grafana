import { setKustoQuery } from '../components/LogsQueryEditor/setQueryValue';
import {
  appendDimensionFilter,
  setTimeGrain as setMetricsTimeGrain,
} from '../components/MetricsQueryEditor/setQueryValue';
import { parseResourceDetails } from '../components/ResourcePicker/utils';
import TimegrainConverter from '../time_grain_converter';
import { AzureMetricDimension, AzureMonitorQuery, AzureQueryType } from '../types/query';

const OLD_DEFAULT_DROPDOWN_VALUE = 'select';

export default function migrateQuery(query: AzureMonitorQuery): AzureMonitorQuery {
  let workingQuery = query;

  if (!workingQuery.queryType) {
    workingQuery = {
      ...workingQuery,
      queryType: AzureQueryType.AzureMonitor,
    };
  }

  workingQuery = migrateLogAnalyticsToFromTimes(workingQuery);
  if (workingQuery.queryType === AzureQueryType.AzureMonitor && workingQuery.azureMonitor) {
    workingQuery = migrateTimeGrains(workingQuery);
    workingQuery = migrateToDefaultNamespace(workingQuery);
    workingQuery = migrateDimensionToDimensionFilter(workingQuery);
    workingQuery = migrateDimensionFilterToArray(workingQuery);
    workingQuery = migrateResourceUriToResourceObj(workingQuery);
  }

  if (workingQuery.azureMonitor?.resourceGroup || workingQuery.azureMonitor?.resourceName) {
    workingQuery = migrateResourceGroupAndName(workingQuery);
  }

  if (workingQuery.azureLogAnalytics?.resource) {
    workingQuery = {
      ...workingQuery,
      azureLogAnalytics: {
        ...workingQuery.azureLogAnalytics,
        resources: [workingQuery.azureLogAnalytics.resource],
      },
    };

    delete workingQuery.azureLogAnalytics?.resource;
  }

  if (workingQuery.azureLogAnalytics && workingQuery.azureLogAnalytics.dashboardTime === undefined) {
    if (workingQuery.azureLogAnalytics.intersectTime) {
      workingQuery = {
        ...workingQuery,
        azureLogAnalytics: {
          ...workingQuery.azureLogAnalytics,
          dashboardTime: true,
        },
      };
    } else {
      workingQuery = {
        ...workingQuery,
        azureLogAnalytics: {
          ...workingQuery.azureLogAnalytics,
          dashboardTime: false,
        },
      };
    }
  }

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
        metricDefinition: undefined,
      },
    };
  }

  return query;
}

function migrateDimensionToDimensionFilter(query: AzureMonitorQuery): AzureMonitorQuery {
  let workingQuery = query;

  const oldDimension = workingQuery.azureMonitor?.dimension;
  if (oldDimension && oldDimension !== 'None') {
    workingQuery = appendDimensionFilter(workingQuery, oldDimension, 'eq', [
      workingQuery.azureMonitor?.dimensionFilter || '',
    ]);
  }

  delete workingQuery.azureMonitor?.dimension;
  delete workingQuery.azureMonitor?.dimensionFilter;

  return workingQuery;
}

function migrateDimensionFilterToArray(query: AzureMonitorQuery): AzureMonitorQuery {
  const azureMonitorQuery = query.azureMonitor;

  if (!azureMonitorQuery) {
    return query;
  }

  const newFilters: AzureMetricDimension[] = [];
  const dimensionFilters = azureMonitorQuery.dimensionFilters;
  if (dimensionFilters && dimensionFilters.length > 0) {
    dimensionFilters.forEach((filter) => {
      const staticProps = { dimension: filter.dimension, operator: filter.operator };
      if (!filter.filters && filter.filter) {
        newFilters.push({ ...staticProps, filters: [filter.filter] });
      } else {
        let hasFilter = false;
        if (filter.filters && filter.filter) {
          for (const oldFilter of filter.filters) {
            if (filter.filter === oldFilter) {
              hasFilter = true;
              break;
            }
          }
          if (!hasFilter && filter.filter !== '*') {
            filter.filters.push(filter.filter);
          }
          newFilters.push({ ...staticProps, filters: filter.filters });
        }
      }
    });
    if (newFilters.length > 0) {
      return { ...query, azureMonitor: { ...azureMonitorQuery, dimensionFilters: newFilters } };
    }
  }
  return query;
}

function migrateResourceUriToResourceObj(query: AzureMonitorQuery): AzureMonitorQuery {
  if (query.azureMonitor?.resourceUri && !query.azureMonitor.resourceUri.startsWith('$')) {
    const details = parseResourceDetails(query.azureMonitor.resourceUri);
    const isWellFormedUri = details?.subscription && details?.resourceGroup && details?.resourceName;
    return {
      ...query,
      subscription: details?.subscription,
      azureMonitor: {
        ...query.azureMonitor,
        resources: [{ resourceGroup: details?.resourceGroup, resourceName: details?.resourceName }],
        metricNamespace: details?.metricNamespace,
        resourceUri: isWellFormedUri ? undefined : query.azureMonitor.resourceUri,
      },
    };
  }

  return query;
}

function migrateResourceGroupAndName(query: AzureMonitorQuery): AzureMonitorQuery {
  let workingQuery = query;

  if (workingQuery.azureMonitor?.resourceGroup && workingQuery.azureMonitor?.resourceName) {
    workingQuery = {
      ...workingQuery,
      azureMonitor: {
        ...workingQuery.azureMonitor,
        resources: [
          {
            resourceGroup: workingQuery.azureMonitor.resourceGroup,
            resourceName: workingQuery.azureMonitor.resourceName,
          },
        ],
      },
    };

    delete workingQuery.azureMonitor?.resourceGroup;
    delete workingQuery.azureMonitor?.resourceName;
  }

  return workingQuery;
}
