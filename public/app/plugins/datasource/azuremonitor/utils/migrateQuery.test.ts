import { AzureMetricDimension, AzureMonitorQuery, AzureQueryType, ResultFormat } from '../types';

import migrateQuery from './migrateQuery';

const azureMonitorQueryV8 = {
  azureMonitor: {
    aggregation: 'Average',
    dimensionFilters: [],
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

const azureMonitorQueryV9_0 = {
  azureMonitor: {
    aggregation: 'Average',
    dimensionFilters: [],
    metricName: 'dependencies/duration',
    metricNamespace: 'microsoft.insights/components',
    resourceUri:
      '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/microsoft.insights/components/AppInsightsTestData',
    timeGrain: 'auto',
  },
  datasource: {
    type: 'grafana-azure-monitor-datasource',
    uid: 'sD-ZuB87k',
  },
  queryType: AzureQueryType.AzureMonitor,
  refId: 'A',
};

const modernMetricsQuery: AzureMonitorQuery = {
  azureLogAnalytics: {
    query:
      '//change this example to create your own time series query\n<table name>                                                              //the table to query (e.g. Usage, Heartbeat, Perf)\n| where $__timeFilter(TimeGenerated)                                      //this is a macro used to show the full chart’s time range, choose the datetime column here\n| summarize count() by <group by column>, bin(TimeGenerated, $__interval) //change “group by column” to a column in your table, such as “Computer”. The $__interval macro is used to auto-select the time grain. Can also use 1h, 5m etc.\n| order by TimeGenerated asc',
    resultFormat: ResultFormat.TimeSeries,
    workspace: 'mock-workspace-id',
  },
  azureMonitor: {
    aggregation: 'Average',
    alias: '{{ dimensionvalue }}',
    allowedTimeGrainsMs: [60000, 300000, 900000, 1800000, 3600000, 21600000, 43200000, 86400000],
    dimensionFilters: [{ dimension: 'dependency/success', filters: ['*'], operator: 'eq' }],
    metricName: 'dependencies/duration',
    metricNamespace: 'microsoft.insights/components',
    resources: [
      {
        resourceGroup: 'cloud-datasources',
        resourceName: 'AppInsightsTestData',
      },
    ],
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
    const result = migrateQuery(modernMetricsQuery);

    // MUST use .toBe because we want to assert that the identity of unmigrated queries remains the same
    expect(modernMetricsQuery).toBe(result);
  });

  describe('migrating from a v8 query to the latest query version', () => {
    it('will not change valid dimension filters', () => {
      const dimensionFilters: AzureMetricDimension[] = [
        { dimension: 'TestDimension', operator: 'eq', filters: ['testFilter'] },
      ];
      const result = migrateQuery({ ...azureMonitorQueryV8, azureMonitor: { dimensionFilters } });
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
      const result = migrateQuery({ ...azureMonitorQueryV8, azureMonitor: { dimensionFilters } });
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
      const result = migrateQuery({ ...azureMonitorQueryV8, azureMonitor: { dimensionFilters } });
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
      const result = migrateQuery({ ...azureMonitorQueryV8, azureMonitor: { dimensionFilters } });
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
      const result = migrateQuery({ ...azureMonitorQueryV8, azureMonitor: { dimensionFilters } });
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
    it('correctly removes outdated fields', () => {
      const result = migrateQuery({
        ...azureMonitorQueryV8,
        azureMonitor: { dimension: 'testDimension', dimensionFilter: 'testFilter' },
      });
      expect(result).toMatchObject(
        expect.objectContaining({
          azureMonitor: expect.objectContaining({
            dimensionFilters: [
              {
                dimension: 'testDimension',
                operator: 'eq',
                filters: ['testFilter'],
              },
            ],
          }),
        })
      );
      expect(result.azureMonitor).not.toHaveProperty('dimension');
      expect(result.azureMonitor).not.toHaveProperty('dimensionFilter');
    });

    it('correctly migrates a metric definition', () => {
      const result = migrateQuery({ ...azureMonitorQueryV8, azureMonitor: { metricDefinition: 'ms.ns/mn' } });
      expect(result).toMatchObject(
        expect.objectContaining({
          azureMonitor: expect.objectContaining({
            metricNamespace: 'ms.ns/mn',
            metricDefinition: undefined,
          }),
        })
      );
    });
  });

  describe('migrating from a v9.0 query to the latest query version', () => {
    it('will parse the resource URI', () => {
      const result = migrateQuery(azureMonitorQueryV9_0);
      expect(result).toMatchObject(
        expect.objectContaining({
          subscription: modernMetricsQuery.subscription,
          azureMonitor: expect.objectContaining({
            metricNamespace: modernMetricsQuery.azureMonitor!.metricNamespace,
            resources: modernMetricsQuery.azureMonitor!.resources,
            resourceUri: undefined,
          }),
        })
      );
    });
  });

  it('should migrate a sigle resource for Logs', () => {
    const q = {
      ...modernMetricsQuery,
      azureLogAnalytics: {
        ...modernMetricsQuery.azureLogAnalytics,
        resource: 'foo',
      },
    };
    const result = migrateQuery(q);
    expect(result.azureLogAnalytics?.resources).toEqual(['foo']);
  });
});
