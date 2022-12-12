import { TemplateSrv } from 'app/features/templating/template_srv';

import { createMockInstanceSetttings } from './__mocks__/cloudMonitoringInstanceSettings';
import { createMockQuery } from './__mocks__/cloudMonitoringQuery';
import Datasource from './datasource';
import { CloudMonitoringQuery, EditorMode, MetricKind, QueryType } from './types';

describe('Cloud Monitoring Datasource', () => {
  describe('interpolateVariablesInQueries', () => {
    it('should leave a query unchanged if there are no template variables', () => {
      const mockInstanceSettings = createMockInstanceSetttings();
      const ds = new Datasource(mockInstanceSettings);
      const query = createMockQuery();
      const templateVariablesApplied = ds.interpolateVariablesInQueries([query], {});
      expect(templateVariablesApplied[0]).toEqual(query);
    });

    it('should correctly apply template variables', () => {
      const templateSrv = new TemplateSrv();
      templateSrv.replace = jest.fn().mockReturnValue('project-variable');
      const mockInstanceSettings = createMockInstanceSetttings();
      const ds = new Datasource(mockInstanceSettings, templateSrv);
      const query = createMockQuery({ metricQuery: { projectName: '$testVar' } });
      const templatedQuery = ds.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      expect(templatedQuery[0].metricQuery.projectName).toEqual('project-variable');
    });
  });

  describe('migrateQuery', () => {
    it('should migrate the query to the new format', () => {
      const mockInstanceSettings = createMockInstanceSetttings();
      const ds = new Datasource(mockInstanceSettings);
      const oldQuery: CloudMonitoringQuery = {
        refId: 'A',
        queryType: QueryType.METRICS,
        intervalMs: 1000,
        metricQuery: {
          metricType: 'cloudsql_database',
          projectName: 'project',
          filters: [],
          groupBys: [],
          aliasBy: '',
          alignmentPeriod: 'cloud-monitoring-auto',
          crossSeriesReducer: 'REDUCE_NONE',
          perSeriesAligner: 'ALIGN_MEAN',
          metricKind: MetricKind.DELTA,
          valueType: 'DOUBLE',
          query: '',
          editorMode: EditorMode.Visual,
        },
      };
      const newQuery = ds.migrateQuery(oldQuery);
      expect(newQuery.timeSeriesList).toEqual({
        alignmentPeriod: 'cloud-monitoring-auto',
        crossSeriesReducer: 'REDUCE_NONE',
        filters: ['AND', 'metric.type', '=', 'cloudsql_database'],
        groupBys: [],
        perSeriesAligner: 'ALIGN_MEAN',
        projectName: 'project',
      });
    });
  });
});
