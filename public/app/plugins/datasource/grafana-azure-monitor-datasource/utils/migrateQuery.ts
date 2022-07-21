import React from 'react';

import { TemplateSrv } from '@grafana/runtime';

import UrlBuilder from '../azure_monitor/url_builder';
import { setKustoQuery } from '../components/LogsQueryEditor/setQueryValue';
import {
  appendDimensionFilter,
  setTimeGrain as setMetricsTimeGrain,
} from '../components/MetricsQueryEditor/setQueryValue';
import TimegrainConverter from '../time_grain_converter';
import { AzureMetricDimension, AzureMonitorErrorish, AzureMonitorQuery, AzureQueryType } from '../types';

const OLD_DEFAULT_DROPDOWN_VALUE = 'select';

export default function migrateQuery(
  query: AzureMonitorQuery,
  templateSrv: TemplateSrv,
  setError: (errorSource: string, error: AzureMonitorErrorish) => void
): AzureMonitorQuery {
  let workingQuery = query;

  // The old angular controller also had a `migrateApplicationInsightsKeys` migraiton that
  // migrated old properties to other properties that still do not appear to be used anymore, so
  // we decided to not include that migration anymore
  // See https://github.com/grafana/grafana/blob/a6a09add/public/app/plugins/datasource/grafana-azure-monitor-datasource/query_ctrl.ts#L269-L288

  workingQuery = migrateTimeGrains(workingQuery);
  workingQuery = migrateLogAnalyticsToFromTimes(workingQuery);
  workingQuery = migrateToDefaultNamespace(workingQuery);
  workingQuery = migrateDimensionToDimensionFilter(workingQuery);
  workingQuery = migrateResourceUri(workingQuery, templateSrv, setError);
  workingQuery = migrateDimensionFilterToArray(workingQuery);

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

  return workingQuery;
}

// Azure Monitor metric queries prior to Grafana version 9 did not include a `resourceUri`.
// The resourceUri was previously constructed with the subscription id, resource group,
// metric definition (a.k.a. resource type), and the resource name.
function migrateResourceUri(
  query: AzureMonitorQuery,
  templateSrv: TemplateSrv,
  setError?: (errorSource: string, error: AzureMonitorErrorish) => void
): AzureMonitorQuery {
  const azureMonitorQuery = query.azureMonitor;

  if (!azureMonitorQuery || azureMonitorQuery.resourceUri) {
    return query;
  }

  const { subscription } = query;
  const { resourceGroup, metricDefinition, resourceName } = azureMonitorQuery;
  if (!(subscription && resourceGroup && metricDefinition && resourceName)) {
    return query;
  }

  const metricDefinitionArray = metricDefinition.split('/');
  if (metricDefinitionArray.some((p) => templateSrv.replace(p).split('/').length > 2)) {
    // If a metric definition includes template variable with a subresource e.g.
    // Microsoft.Storage/storageAccounts/libraries, it's not possible to generate a valid
    // resource URI
    if (setError) {
      setError(
        'Resource URI migration',
        React.createElement(
          'div',
          null,
          `Failed to create resource URI. Validate the metric definition template variable against supported cases `,
          React.createElement(
            'a',
            {
              href: 'https://grafana.com/docs/grafana/latest/datasources/azuremonitor/template-variables/',
            },
            'here.'
          )
        )
      );
    }
    return query;
  }

  const resourceNameArray = resourceName.split('/');
  if (resourceNameArray.some((p) => templateSrv.replace(p).split('/').length > 1)) {
    // If a resource name includes template variable with a subresource e.g.
    // abc123/def456, it's not possible to generate a valid resource URI
    if (setError) {
      setError(
        'Resource URI migration',
        React.createElement(
          'div',
          null,
          `Failed to create resource URI. Validate the resource name template variable against supported cases `,
          React.createElement(
            'a',
            {
              href: 'https://grafana.com/docs/grafana/latest/datasources/azuremonitor/template-variables/',
            },
            'here.'
          )
        )
      );
    }
    return query;
  }

  const resourceUri = UrlBuilder.buildResourceUri(
    subscription,
    resourceGroup,
    metricDefinition,
    resourceName,
    templateSrv
  );

  return {
    ...query,
    azureMonitor: {
      ...azureMonitorQuery,
      resourceUri,
    },
  };
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

// datasource.ts also contains some migrations, which have been moved to here. Unsure whether
// they should also do all the other migrations...
export function datasourceMigrations(query: AzureMonitorQuery, templateSrv: TemplateSrv): AzureMonitorQuery {
  let workingQuery = query;

  if (!workingQuery.queryType) {
    workingQuery = {
      ...workingQuery,
      queryType: AzureQueryType.AzureMonitor,
    };
  }

  if (workingQuery.queryType === AzureQueryType.AzureMonitor && workingQuery.azureMonitor) {
    workingQuery = migrateDimensionToDimensionFilter(workingQuery);
    workingQuery = migrateResourceUri(workingQuery, templateSrv);
    workingQuery = migrateDimensionFilterToArray(workingQuery);
  }

  return workingQuery;
}
