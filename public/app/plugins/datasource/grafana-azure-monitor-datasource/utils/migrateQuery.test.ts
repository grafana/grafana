import React from 'react';

import { getTemplateSrv } from '@grafana/runtime';

import { AzureMetricDimension, AzureMonitorErrorish, AzureMonitorQuery, AzureQueryType } from '../types';

import migrateQuery from './migrateQuery';

let replaceMock = jest.fn().mockImplementation((s: string) => s);
jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getTemplateSrv: () => ({
      replace: replaceMock,
    }),
  };
});

let templateSrv = getTemplateSrv();

let setErrorMock = jest.fn();

const azureMonitorQueryV7 = {
  appInsights: { dimension: [], metricName: 'select', timeGrain: 'auto' },
  azureLogAnalytics: {
    query:
      '//change this example to create your own time series query\n<table name>                                                              //the table to query (e.g. Usage, Heartbeat, Perf)\n| where $__timeFilter(TimeGenerated)                                      //this is a macro used to show the full chart’s time range, choose the datetime column here\n| summarize count() by <group by column>, bin(TimeGenerated, $__interval) //change “group by column” to a column in your table, such as “Computer”. The $__interval macro is used to auto-select the time grain. Can also use 1h, 5m etc.\n| order by TimeGenerated asc',
    resultFormat: 'time_series',
    workspace: 'mock-workspace-id',
  },
  azureMonitor: {
    aggregation: 'Average',
    allowedTimeGrainsMs: [60000, 300000, 900000, 1800000, 3600000, 21600000, 43200000, 86400000],
    dimensionFilters: [{ dimension: 'dependency/success', filter: '', operator: 'eq' }],
    metricDefinition: 'microsoft.insights/components',
    metricName: 'dependencies/duration',
    metricNamespace: 'microsoft.insights/components',
    resourceGroup: 'cloud-datasources',
    resourceName: 'AppInsightsTestData',
    timeGrain: 'auto',
    top: '10',
  },
  insightsAnalytics: {
    query: '',
    resultFormat: 'time_series',
  },
  queryType: AzureQueryType.AzureMonitor,
  refId: 'A',
  subscription: '44693801-6ee6-49de-9b2d-9106972f9572',
};

const azureMonitorQueryV8 = {
  azureMonitor: {
    aggregation: 'Average',
    dimensionFilters: [],
    metricDefinition: 'microsoft.insights/components',
    metricName: 'dependencies/duration',
    metricNamespace: 'microsoft.insights/components',
    resourceGroup: 'cloud-datasources',
    resourceName: 'AppInsightsTestData',
    timeGrain: 'auto',
  },
  datasource: {
    type: 'grafana-azure-monitor-datasource',
    uid: 'sD-ZuB87k',
  },
  queryType: AzureQueryType.AzureMonitor,
  refId: 'A',
  subscription: '44693801-6ee6-49de-9b2d-9106972f9572',
};

const modernMetricsQuery: AzureMonitorQuery = {
  azureLogAnalytics: {
    query:
      '//change this example to create your own time series query\n<table name>                                                              //the table to query (e.g. Usage, Heartbeat, Perf)\n| where $__timeFilter(TimeGenerated)                                      //this is a macro used to show the full chart’s time range, choose the datetime column here\n| summarize count() by <group by column>, bin(TimeGenerated, $__interval) //change “group by column” to a column in your table, such as “Computer”. The $__interval macro is used to auto-select the time grain. Can also use 1h, 5m etc.\n| order by TimeGenerated asc',
    resultFormat: 'time_series',
    workspace: 'mock-workspace-id',
  },
  azureMonitor: {
    aggregation: 'Average',
    alias: '{{ dimensionvalue }}',
    allowedTimeGrainsMs: [60000, 300000, 900000, 1800000, 3600000, 21600000, 43200000, 86400000],
    dimensionFilters: [{ dimension: 'dependency/success', filters: ['*'], operator: 'eq' }],
    metricDefinition: 'microsoft.insights/components',
    metricName: 'dependencies/duration',
    metricNamespace: 'microsoft.insights/components',
    resourceGroup: 'cloud-datasources',
    resourceName: 'AppInsightsTestData',
    resourceUri:
      '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/microsoft.insights/components/AppInsightsTestData',
    timeGrain: 'PT5M',
    top: '10',
  },
  azureResourceGraph: { resultFormat: 'table' },
  queryType: AzureQueryType.AzureMonitor,
  refId: 'A',
  subscription: '44693801-6ee6-49de-9b2d-9106972f9572',
  subscriptions: ['44693801-6ee6-49de-9b2d-9106972f9572'],
};

describe('AzureMonitor: migrateQuery', () => {
  it('modern queries should not change', () => {
    const result = migrateQuery(modernMetricsQuery, templateSrv, setErrorMock);

    // MUST use .toBe because we want to assert that the identity of unmigrated queries remains the same
    expect(modernMetricsQuery).toBe(result);
  });

  describe('migrating from a v7 query to the latest query version', () => {
    it('should build a resource uri', () => {
      const result = migrateQuery(azureMonitorQueryV7, templateSrv, setErrorMock);
      expect(result).toMatchObject(
        expect.objectContaining({
          azureMonitor: expect.objectContaining({
            resourceUri:
              '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/microsoft.insights/components/AppInsightsTestData',
          }),
        })
      );
    });
  });

  describe('migrating from a v8 query to the latest query version', () => {
    it('should build a resource uri', () => {
      const result = migrateQuery(azureMonitorQueryV8, templateSrv, setErrorMock);
      expect(result).toMatchObject(
        expect.objectContaining({
          azureMonitor: expect.objectContaining({
            resourceUri:
              '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/microsoft.insights/components/AppInsightsTestData',
          }),
        })
      );
    });

    it('should not build a resource uri with an unsupported namespace template variable', () => {
      replaceMock = jest
        .fn()
        .mockImplementation((s: string) => s.replace('$ns', 'Microsoft.Storage/storageAccounts/tableServices'));
      setErrorMock = jest
        .fn()
        .mockImplementation((errorSource: string, error: AzureMonitorErrorish) => 'Template Var error');
      const errorElement = React.createElement(
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
      );
      templateSrv = getTemplateSrv();
      const query = {
        ...azureMonitorQueryV8,
        azureMonitor: {
          ...azureMonitorQueryV8.azureMonitor,
          metricDefinition: '$ns',
        },
      };
      const result = migrateQuery(query, templateSrv, setErrorMock);
      expect(result.azureMonitor?.resourceUri).toBeUndefined();
      expect(setErrorMock).toHaveBeenCalledWith('Resource URI migration', errorElement);
    });

    it('should not build a resource uri with unsupported resource name template variable', () => {
      replaceMock = jest.fn().mockImplementation((s: string) => s.replace('$resource', 'resource/default'));
      setErrorMock = jest
        .fn()
        .mockImplementation((errorSource: string, error: AzureMonitorErrorish) => 'Template Var error');
      const errorElement = React.createElement(
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
      );
      templateSrv = getTemplateSrv();
      const query = {
        ...azureMonitorQueryV8,
        azureMonitor: {
          ...azureMonitorQueryV8.azureMonitor,
          resourceName: '$resource',
        },
      };
      const result = migrateQuery(query, templateSrv, setErrorMock);
      expect(result.azureMonitor?.resourceUri).toBeUndefined();
      expect(setErrorMock).toHaveBeenCalledWith('Resource URI migration', errorElement);
    });
  });

  describe('migrating from a v9 query to the latest query version', () => {
    it('will not change valid dimension filters', () => {
      const dimensionFilters: AzureMetricDimension[] = [
        { dimension: 'TestDimension', operator: 'eq', filters: ['testFilter'] },
      ];
      const result = migrateQuery(
        { ...azureMonitorQueryV8, azureMonitor: { dimensionFilters } },
        templateSrv,
        setErrorMock
      );
      expect(result).toMatchObject(
        expect.objectContaining({
          azureMonitor: expect.objectContaining({
            dimensionFilters,
          }),
        })
      );
    });
    it('correctly updates old filter containing wildcard', () => {
      const dimensionFilters: AzureMetricDimension[] = [{ dimension: 'TestDimension', operator: 'eq', filter: '*' }];
      const result = migrateQuery(
        { ...azureMonitorQueryV8, azureMonitor: { dimensionFilters } },
        templateSrv,
        setErrorMock
      );
      expect(result).toMatchObject(
        expect.objectContaining({
          azureMonitor: expect.objectContaining({
            dimensionFilters: [
              { dimension: dimensionFilters[0].dimension, operator: dimensionFilters[0].operator, filters: ['*'] },
            ],
          }),
        })
      );
    });
    it('correctly updates old filter containing value', () => {
      const dimensionFilters: AzureMetricDimension[] = [{ dimension: 'TestDimension', operator: 'eq', filter: 'test' }];
      const result = migrateQuery(
        { ...azureMonitorQueryV8, azureMonitor: { dimensionFilters } },
        templateSrv,
        setErrorMock
      );
      expect(result).toMatchObject(
        expect.objectContaining({
          azureMonitor: expect.objectContaining({
            dimensionFilters: [
              { dimension: dimensionFilters[0].dimension, operator: dimensionFilters[0].operator, filters: ['test'] },
            ],
          }),
        })
      );
    });
    it('correctly ignores wildcard if filters has a value', () => {
      const dimensionFilters: AzureMetricDimension[] = [
        { dimension: 'TestDimension', operator: 'eq', filter: '*', filters: ['testFilter'] },
      ];
      const result = migrateQuery(
        { ...azureMonitorQueryV8, azureMonitor: { dimensionFilters } },
        templateSrv,
        setErrorMock
      );
      expect(result).toMatchObject(
        expect.objectContaining({
          azureMonitor: expect.objectContaining({
            dimensionFilters: [
              {
                dimension: dimensionFilters[0].dimension,
                operator: dimensionFilters[0].operator,
                filters: ['testFilter'],
              },
            ],
          }),
        })
      );
    });
    it('correctly ignores duplicates', () => {
      const dimensionFilters: AzureMetricDimension[] = [
        { dimension: 'TestDimension', operator: 'eq', filter: 'testFilter', filters: ['testFilter'] },
      ];
      const result = migrateQuery(
        { ...azureMonitorQueryV8, azureMonitor: { dimensionFilters } },
        templateSrv,
        setErrorMock
      );
      expect(result).toMatchObject(
        expect.objectContaining({
          azureMonitor: expect.objectContaining({
            dimensionFilters: [
              {
                dimension: dimensionFilters[0].dimension,
                operator: dimensionFilters[0].operator,
                filters: ['testFilter'],
              },
            ],
          }),
        })
      );
    });
  });
});
