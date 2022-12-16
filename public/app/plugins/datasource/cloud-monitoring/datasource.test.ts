import { TemplateSrv } from 'app/features/templating/template_srv';

import { createMockInstanceSetttings } from './__mocks__/cloudMonitoringInstanceSettings';
import { createMockQuery } from './__mocks__/cloudMonitoringQuery';
import Datasource from './datasource';
import { CloudMonitoringQuery, MetricKind, PreprocessorType, QueryType } from './types';

describe('Cloud Monitoring Datasource', () => {
  describe('interpolateVariablesInQueries', () => {
    it('should leave a query unchanged if there are no template variables', () => {
      const mockInstanceSettings = createMockInstanceSetttings();
      const ds = new Datasource(mockInstanceSettings);
      const query = createMockQuery();
      const templateVariablesApplied = ds.interpolateVariablesInQueries([query], {});
      expect(templateVariablesApplied[0]).toEqual(query);
    });

    it('should correctly apply template variables for metricQuery (deprecated)', () => {
      const templateSrv = new TemplateSrv();
      templateSrv.replace = jest.fn().mockReturnValue('project-variable');
      const mockInstanceSettings = createMockInstanceSetttings();
      const ds = new Datasource(mockInstanceSettings, templateSrv);
      const query = createMockQuery({ timeSeriesList: { projectName: '$testVar', crossSeriesReducer: '' } });
      const templatedQuery = ds.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      expect(templatedQuery[0].timeSeriesList?.projectName).toEqual('project-variable');
    });

    it('should correctly apply template variables for timeSeriesList', () => {
      const templateSrv = new TemplateSrv();
      templateSrv.replace = jest.fn().mockReturnValue('project-variable');
      const mockInstanceSettings = createMockInstanceSetttings();
      const ds = new Datasource(mockInstanceSettings, templateSrv);
      const query = createMockQuery({ timeSeriesList: { projectName: '$testVar', crossSeriesReducer: '' } });
      const templatedQuery = ds.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      expect(templatedQuery[0].timeSeriesList?.projectName).toEqual('project-variable');
    });

    it('should correctly apply template variables for timeSeriesQuery', () => {
      const templateSrv = new TemplateSrv();
      templateSrv.replace = jest.fn().mockReturnValue('project-variable');
      const mockInstanceSettings = createMockInstanceSetttings();
      const ds = new Datasource(mockInstanceSettings, templateSrv);
      const query = createMockQuery({ timeSeriesQuery: { projectName: '$testVar', query: '' } });
      const templatedQuery = ds.interpolateVariablesInQueries([query], {});
      expect(templatedQuery[0]).toHaveProperty('datasource');
      expect(templatedQuery[0].timeSeriesList?.projectName).toEqual('project-variable');
    });
  });

  describe('migrateQuery', () => {
    describe('should migrate the query to the new format', () => {
      [
        {
          description: 'a list query with a metric type and no filters',
          input: {
            refId: 'A',
            queryType: QueryType.TIME_SERIES_LIST,
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
              editorMode: 'visual',
            },
          },
          expected: {
            alignmentPeriod: 'cloud-monitoring-auto',
            crossSeriesReducer: 'REDUCE_NONE',
            filters: ['metric.type', '=', 'cloudsql_database'],
            groupBys: [],
            perSeriesAligner: 'ALIGN_MEAN',
            projectName: 'project',
          },
        },
        {
          description: 'a list query with filters',
          input: {
            refId: 'A',
            queryType: QueryType.TIME_SERIES_LIST,
            intervalMs: 1000,
            metricQuery: {
              metricType: 'cloudsql_database',
              projectName: 'project',
              filters: ['foo', '=', 'bar'],
              groupBys: [],
              aliasBy: '',
              alignmentPeriod: 'cloud-monitoring-auto',
              crossSeriesReducer: 'REDUCE_NONE',
              perSeriesAligner: 'ALIGN_MEAN',
              metricKind: MetricKind.DELTA,
              valueType: 'DOUBLE',
              query: '',
              editorMode: 'visual',
            },
          },
          expected: {
            alignmentPeriod: 'cloud-monitoring-auto',
            crossSeriesReducer: 'REDUCE_NONE',
            filters: ['foo', '=', 'bar', 'AND', 'metric.type', '=', 'cloudsql_database'],
            groupBys: [],
            perSeriesAligner: 'ALIGN_MEAN',
            projectName: 'project',
          },
        },
        {
          description: 'a list query with preprocessor',
          input: {
            refId: 'A',
            queryType: QueryType.TIME_SERIES_LIST,
            intervalMs: 1000,
            metricQuery: {
              metricType: 'cloudsql_database',
              projectName: 'project',
              filters: ['foo', '=', 'bar'],
              groupBys: [],
              aliasBy: '',
              alignmentPeriod: 'cloud-monitoring-auto',
              crossSeriesReducer: 'REDUCE_NONE',
              perSeriesAligner: 'ALIGN_MEAN',
              metricKind: MetricKind.DELTA,
              valueType: 'DOUBLE',
              query: '',
              editorMode: 'visual',
              preprocessor: PreprocessorType.Delta,
            },
          },
          expected: {
            alignmentPeriod: 'cloud-monitoring-auto',
            crossSeriesReducer: 'REDUCE_NONE',
            filters: ['foo', '=', 'bar', 'AND', 'metric.type', '=', 'cloudsql_database'],
            groupBys: [],
            projectName: 'project',
            perSeriesAligner: 'ALIGN_MEAN',
            preprocessor: PreprocessorType.Delta,
          },
        },
        {
          description: 'a mql query',
          input: {
            refId: 'A',
            queryType: QueryType.TIME_SERIES_QUERY,
            intervalMs: 1000,
            metricQuery: {
              metricType: 'cloudsql_database',
              projectName: 'project',
              filters: ['foo', '=', 'bar'],
              groupBys: [],
              aliasBy: '',
              alignmentPeriod: 'cloud-monitoring-auto',
              crossSeriesReducer: 'REDUCE_NONE',
              perSeriesAligner: 'ALIGN_MEAN',
              metricKind: MetricKind.DELTA,
              valueType: 'DOUBLE',
              query: 'test query',
              editorMode: 'mql',
            },
          },
          expected: {
            projectName: 'project',
            query: 'test query',
          },
        },
      ].forEach((t) =>
        it(t.description, () => {
          const mockInstanceSettings = createMockInstanceSetttings();
          const ds = new Datasource(mockInstanceSettings);
          const oldQuery: CloudMonitoringQuery = { ...t.input };
          const newQuery = ds.migrateQuery(oldQuery);
          if (t.input.metricQuery.editorMode === 'mql') {
            expect(newQuery.timeSeriesQuery).toEqual(t.expected);
          } else {
            expect(newQuery.timeSeriesList).toEqual(t.expected);
          }
        })
      );
    });
  });
});
