jest.mock('./css/query_editor.css', () => {
  return {};
});

import { AzureMonitorQueryCtrl } from './query_ctrl';
// @ts-ignore
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
      expect(!!(queryCtrl.target.appInsights as any).rawQuery).toBe(false);
    });

    it('should set query parts to select', () => {
      // expect(queryCtrl.target.azureMonitor.resourceGroup).toBe('select');
      // expect(queryCtrl.target.azureMonitor.metricDefinition).toBe('select');
      // expect(queryCtrl.target.azureMonitor.resourceName).toBe('select');
      // expect(queryCtrl.target.azureMonitor.metricNamespace).toBe('select');
      // expect(queryCtrl.target.azureMonitor.metricName).toBe('select');
      expect(queryCtrl.target.appInsights.dimension).toMatchObject([]);
    });
  });

  describe('and query type is Application Insights', () => {
    describe('and target is in old format', () => {
      it('data is migrated', () => {
        queryCtrl.target.appInsights.xaxis = 'sample-x';
        queryCtrl.target.appInsights.yaxis = 'sample-y';
        queryCtrl.target.appInsights.spliton = 'sample-split';
        queryCtrl.target.appInsights.groupBy = 'sample-group';
        queryCtrl.target.appInsights.groupByOptions = ['sample-group-1', 'sample-group-2'];
        queryCtrl.target.appInsights.filter = 'sample-filter';
        queryCtrl.target.appInsights.metricName = 'sample-metric';

        queryCtrl.migrateApplicationInsightsKeys();

        expect(queryCtrl.target.appInsights.xaxis).toBeUndefined();
        expect(queryCtrl.target.appInsights.yaxis).toBeUndefined();
        expect(queryCtrl.target.appInsights.spliton).toBeUndefined();
        expect(queryCtrl.target.appInsights.groupBy).toBeUndefined();
        expect(queryCtrl.target.appInsights.groupByOptions).toBeUndefined();
        expect(queryCtrl.target.appInsights.filter).toBeUndefined();

        expect(queryCtrl.target.appInsights.timeColumn).toBe('sample-x');
        expect(queryCtrl.target.appInsights.valueColumn).toBe('sample-y');
        expect(queryCtrl.target.appInsights.segmentColumn).toBe('sample-split');
        expect(queryCtrl.target.appInsights.dimension).toBe('sample-group');
        expect(queryCtrl.target.appInsights.dimensions).toEqual(['sample-group-1', 'sample-group-2']);
        expect(queryCtrl.target.appInsights.dimensionFilter).toBe('sample-filter');
        expect(queryCtrl.target.appInsights.metricName).toBe('sample-metric');
      });
    });

    describe('when getOptions for the Metric Names dropdown is called', () => {
      const response = [
        { text: 'metric1', value: 'metric1' },
        { text: 'metric2', value: 'metric2' },
      ];

      beforeEach(() => {
        queryCtrl.datasource.appInsightsDatasource.isConfigured = () => true;
        queryCtrl.datasource.getAppInsightsMetricNames = () => {
          return Promise.resolve(response);
        };
      });

      it('should return a list of Metric Names', () => {
        return queryCtrl.getAppInsightsMetricNames().then((result: any) => {
          expect(result[0].text).toBe('metric1');
          expect(result[1].text).toBe('metric2');
        });
      });
    });

    describe('when getOptions for the GroupBy segments dropdown is called', () => {
      beforeEach(() => {
        queryCtrl.target.appInsights.dimensions = ['opt1', 'opt2'];
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
        queryCtrl.datasource.getAppInsightsMetricMetadata = (metricName: string) => {
          expect(metricName).toBe('requests/failed');
          return Promise.resolve(response);
        };
      });

      it('should set the options and default selected value for the Aggregations dropdown', () => {
        return queryCtrl.onAppInsightsMetricNameChange().then(() => {
          expect(queryCtrl.target.appInsights.aggregation).toBe('avg');
          expect(queryCtrl.target.appInsights.aggOptions).toContain('avg');
          expect(queryCtrl.target.appInsights.aggOptions).toContain('sum');
          expect(queryCtrl.target.appInsights.dimensions).toContain('client/os');
          expect(queryCtrl.target.appInsights.dimensions).toContain('client/city');
        });
      });
    });
  });
});
