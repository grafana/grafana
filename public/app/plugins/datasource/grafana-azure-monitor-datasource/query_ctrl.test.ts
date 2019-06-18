jest.mock('./css/query_editor.css', () => {
  return {};
});

import { AzureMonitorQueryCtrl } from './query_ctrl';
import Q from 'q';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { auto } from 'angular';

describe('AzureMonitorQueryCtrl', () => {
  let queryCtrl: any;

  beforeEach(() => {
    AzureMonitorQueryCtrl.prototype.panelCtrl = {
      events: { on: () => {} },
      panel: { scopedVars: [], targets: [] },
    };
    AzureMonitorQueryCtrl.prototype.target = {} as any;
    AzureMonitorQueryCtrl.prototype.datasource = {
      $q: Q,
      appInsightsDatasource: { isConfigured: () => false },
      azureMonitorDatasource: { isConfigured: () => false },
    };

    queryCtrl = new AzureMonitorQueryCtrl({}, {} as auto.IInjectorService, new TemplateSrv());
  });

  describe('init query_ctrl variables', () => {
    it('should set default query type to Azure Monitor', () => {
      expect(queryCtrl.target.queryType).toBe('Azure Monitor');
    });

    it('should set default App Insights editor to be builder', () => {
      expect(queryCtrl.target.appInsights.rawQuery).toBe(false);
    });

    it('should set query parts to select', () => {
      expect(queryCtrl.target.azureMonitor.resourceGroup).toBe('select');
      expect(queryCtrl.target.azureMonitor.metricDefinition).toBe('select');
      expect(queryCtrl.target.azureMonitor.resourceName).toBe('select');
      expect(queryCtrl.target.azureMonitor.metricName).toBe('select');
      expect(queryCtrl.target.appInsights.groupBy).toBe('none');
    });
  });

  describe('when the query type is Azure Monitor', () => {
    describe('and getOptions for the Resource Group dropdown is called', () => {
      const response = [{ text: 'nodeapp', value: 'nodeapp' }, { text: 'otherapp', value: 'otherapp' }];

      beforeEach(() => {
        queryCtrl.datasource.getResourceGroups = () => {
          return queryCtrl.datasource.$q.when(response);
        };
        queryCtrl.datasource.azureMonitorDatasource = {
          isConfigured: () => {
            return true;
          },
        };
      });

      it('should return a list of Resource Groups', () => {
        return queryCtrl.getResourceGroups('').then(result => {
          expect(result[0].text).toBe('nodeapp');
        });
      });
    });

    describe('when getOptions for the Metric Definition dropdown is called', () => {
      describe('and resource group has a value', () => {
        const response = [
          { text: 'Microsoft.Compute/virtualMachines', value: 'Microsoft.Compute/virtualMachines' },
          { text: 'Microsoft.Network/publicIPAddresses', value: 'Microsoft.Network/publicIPAddresses' },
        ];

        beforeEach(() => {
          queryCtrl.target.subscription = 'sub1';
          queryCtrl.target.azureMonitor.resourceGroup = 'test';
          queryCtrl.datasource.getMetricDefinitions = function(subscriptionId, query) {
            expect(subscriptionId).toBe('sub1');
            expect(query).toBe('test');
            return this.$q.when(response);
          };
        });

        it('should return a list of Metric Definitions', () => {
          return queryCtrl.getMetricDefinitions('').then(result => {
            expect(result[0].text).toBe('Microsoft.Compute/virtualMachines');
            expect(result[1].text).toBe('Microsoft.Network/publicIPAddresses');
          });
        });
      });

      describe('and resource group has no value', () => {
        beforeEach(() => {
          queryCtrl.target.azureMonitor.resourceGroup = 'select';
        });

        it('should return without making a call to datasource', () => {
          expect(queryCtrl.getMetricDefinitions('')).toBe(undefined);
        });
      });
    });

    describe('when getOptions for the ResourceNames dropdown is called', () => {
      describe('and resourceGroup and metricDefinition have values', () => {
        const response = [{ text: 'test1', value: 'test1' }, { text: 'test2', value: 'test2' }];

        beforeEach(() => {
          queryCtrl.target.subscription = 'sub1';
          queryCtrl.target.azureMonitor.resourceGroup = 'test';
          queryCtrl.target.azureMonitor.metricDefinition = 'Microsoft.Compute/virtualMachines';
          queryCtrl.datasource.getResourceNames = function(subscriptionId, resourceGroup, metricDefinition) {
            expect(subscriptionId).toBe('sub1');
            expect(resourceGroup).toBe('test');
            expect(metricDefinition).toBe('Microsoft.Compute/virtualMachines');
            return this.$q.when(response);
          };
        });

        it('should return a list of Resource Names', () => {
          return queryCtrl.getResourceNames('').then(result => {
            expect(result[0].text).toBe('test1');
            expect(result[1].text).toBe('test2');
          });
        });
      });

      describe('and resourceGroup and metricDefinition do not have values', () => {
        beforeEach(() => {
          queryCtrl.target.azureMonitor.resourceGroup = 'select';
          queryCtrl.target.azureMonitor.metricDefinition = 'select';
        });

        it('should return without making a call to datasource', () => {
          expect(queryCtrl.getResourceNames('')).toBe(undefined);
        });
      });
    });

    describe('when getOptions for the Metric Names dropdown is called', () => {
      describe('and resourceGroup, metricDefinition and resourceName have values', () => {
        const response = [{ text: 'metric1', value: 'metric1' }, { text: 'metric2', value: 'metric2' }];

        beforeEach(() => {
          queryCtrl.target.subscription = 'sub1';
          queryCtrl.target.azureMonitor.resourceGroup = 'test';
          queryCtrl.target.azureMonitor.metricDefinition = 'Microsoft.Compute/virtualMachines';
          queryCtrl.target.azureMonitor.resourceName = 'test';
          queryCtrl.datasource.getMetricNames = function(
            subscriptionId,
            resourceGroup,
            metricDefinition,
            resourceName
          ) {
            expect(subscriptionId).toBe('sub1');
            expect(resourceGroup).toBe('test');
            expect(metricDefinition).toBe('Microsoft.Compute/virtualMachines');
            expect(resourceName).toBe('test');
            return this.$q.when(response);
          };
        });

        it('should return a list of Metric Names', () => {
          return queryCtrl.getMetricNames('').then(result => {
            expect(result[0].text).toBe('metric1');
            expect(result[1].text).toBe('metric2');
          });
        });
      });

      describe('and resourceGroup, metricDefinition and resourceName do not have values', () => {
        beforeEach(() => {
          queryCtrl.target.azureMonitor.resourceGroup = 'select';
          queryCtrl.target.azureMonitor.metricDefinition = 'select';
          queryCtrl.target.azureMonitor.resourceName = 'select';
        });

        it('should return without making a call to datasource', () => {
          expect(queryCtrl.getMetricNames('')).toBe(undefined);
        });
      });
    });

    describe('when onMetricNameChange is triggered for the Metric Names dropdown', () => {
      const response = {
        primaryAggType: 'Average',
        supportAggOptions: ['Average', 'Total'],
        supportedTimeGrains: ['PT1M', 'P1D'],
        dimensions: [],
      };

      beforeEach(() => {
        queryCtrl.target.subscription = 'sub1';
        queryCtrl.target.azureMonitor.resourceGroup = 'test';
        queryCtrl.target.azureMonitor.metricDefinition = 'Microsoft.Compute/virtualMachines';
        queryCtrl.target.azureMonitor.resourceName = 'test';
        queryCtrl.target.azureMonitor.metricName = 'Percentage CPU';
        queryCtrl.datasource.getMetricMetadata = function(
          subscription,
          resourceGroup,
          metricDefinition,
          resourceName,
          metricName
        ) {
          expect(subscription).toBe('sub1');
          expect(resourceGroup).toBe('test');
          expect(metricDefinition).toBe('Microsoft.Compute/virtualMachines');
          expect(resourceName).toBe('test');
          expect(metricName).toBe('Percentage CPU');
          return this.$q.when(response);
        };
      });

      it('should set the options and default selected value for the Aggregations dropdown', () => {
        queryCtrl.onMetricNameChange().then(() => {
          expect(queryCtrl.target.azureMonitor.aggregation).toBe('Average');
          expect(queryCtrl.target.azureMonitor.aggOptions).toBe(['Average', 'Total']);
          expect(queryCtrl.target.azureMonitor.timeGrains).toBe(['PT1M', 'P1D']);
        });
      });
    });
  });

  describe('and query type is Application Insights', () => {
    describe('when getOptions for the Metric Names dropdown is called', () => {
      const response = [{ text: 'metric1', value: 'metric1' }, { text: 'metric2', value: 'metric2' }];

      beforeEach(() => {
        queryCtrl.datasource.appInsightsDatasource.isConfigured = () => true;
        queryCtrl.datasource.getAppInsightsMetricNames = () => {
          return queryCtrl.datasource.$q.when(response);
        };
      });

      it('should return a list of Metric Names', () => {
        return queryCtrl.getAppInsightsMetricNames().then(result => {
          expect(result[0].text).toBe('metric1');
          expect(result[1].text).toBe('metric2');
        });
      });
    });

    describe('when getOptions for the GroupBy segments dropdown is called', () => {
      beforeEach(() => {
        queryCtrl.target.appInsights.groupByOptions = ['opt1', 'opt2'];
      });

      it('should return a list of GroupBy segments', () => {
        const result = queryCtrl.getAppInsightsGroupBySegments('');
        expect(result[0].text).toBe('opt1');
        expect(result[0].value).toBe('opt1');
        expect(result[1].text).toBe('opt2');
        expect(result[1].value).toBe('opt2');
      });
    });

    describe('when onAppInsightsMetricNameChange is triggered for the Metric Names dropdown', () => {
      const response = {
        primaryAggType: 'avg',
        supportedAggTypes: ['avg', 'sum'],
        supportedGroupBy: ['client/os', 'client/city'],
      };

      beforeEach(() => {
        queryCtrl.target.appInsights.metricName = 'requests/failed';
        queryCtrl.datasource.getAppInsightsMetricMetadata = function(metricName) {
          expect(metricName).toBe('requests/failed');
          return this.$q.when(response);
        };
      });

      it('should set the options and default selected value for the Aggregations dropdown', () => {
        return queryCtrl.onAppInsightsMetricNameChange().then(() => {
          expect(queryCtrl.target.appInsights.aggregation).toBe('avg');
          expect(queryCtrl.target.appInsights.aggOptions).toContain('avg');
          expect(queryCtrl.target.appInsights.aggOptions).toContain('sum');
          expect(queryCtrl.target.appInsights.groupByOptions).toContain('client/os');
          expect(queryCtrl.target.appInsights.groupByOptions).toContain('client/city');
        });
      });
    });
  });
});
