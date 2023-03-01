import { get } from 'lodash';
import { lastValueFrom, of } from 'rxjs';

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
            queryType: 'metrics',
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
            timeSeriesList: {
              alignmentPeriod: 'cloud-monitoring-auto',
              crossSeriesReducer: 'REDUCE_NONE',
              filters: ['metric.type', '=', 'cloudsql_database'],
              groupBys: [],
              perSeriesAligner: 'ALIGN_MEAN',
              projectName: 'project',
            },
          },
        },
        {
          description: 'a list query with filters',
          input: {
            refId: 'A',
            queryType: 'metrics',
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
            timeSeriesList: {
              alignmentPeriod: 'cloud-monitoring-auto',
              crossSeriesReducer: 'REDUCE_NONE',
              filters: ['foo', '=', 'bar', 'AND', 'metric.type', '=', 'cloudsql_database'],
              groupBys: [],
              perSeriesAligner: 'ALIGN_MEAN',
              projectName: 'project',
            },
          },
        },
        {
          description: 'a list query with preprocessor',
          input: {
            refId: 'A',
            queryType: 'metrics',
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
            timeSeriesList: {
              alignmentPeriod: 'cloud-monitoring-auto',
              crossSeriesReducer: 'REDUCE_NONE',
              filters: ['foo', '=', 'bar', 'AND', 'metric.type', '=', 'cloudsql_database'],
              groupBys: [],
              projectName: 'project',
              perSeriesAligner: 'ALIGN_MEAN',
              preprocessor: PreprocessorType.Delta,
            },
          },
        },
        {
          description: 'a mql query',
          input: {
            refId: 'A',
            queryType: 'metrics',
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
            timeSeriesQuery: {
              projectName: 'project',
              query: 'test query',
            },
          },
        },
        {
          description: 'a SLO query with alias',
          input: {
            refId: 'A',
            queryType: QueryType.SLO,
            intervalMs: 1000,
            sloQuery: {
              aliasBy: 'alias',
            },
          },
          expected: {
            aliasBy: 'alias',
            sloQuery: {},
          },
        },
      ].forEach((t) =>
        it(t.description, () => {
          const mockInstanceSettings = createMockInstanceSetttings();
          const ds = new Datasource(mockInstanceSettings);
          const oldQuery = { ...t.input } as CloudMonitoringQuery;
          const newQuery = ds.migrateQuery(oldQuery);
          expect(get(newQuery, 'metricQuery')).toBeUndefined();
          expect(newQuery).toMatchObject(t.expected);
        })
      );
    });
  });

  describe('filterQuery', () => {
    [
      {
        description: 'should filter out queries with no metric type',
        input: {},
        expected: false,
      },
      {
        description: 'should include an SLO query',
        input: {
          queryType: QueryType.SLO,
          sloQuery: {
            selectorName: 'selector',
            serviceId: 'service',
            sloId: 'slo',
            projectName: 'project',
            lookbackPeriod: '30d',
          },
        },
        expected: true,
      },
      {
        description: 'should include a time series query',
        input: {
          queryType: QueryType.TIME_SERIES_QUERY,
          timeSeriesQuery: {
            projectName: 'project',
            query: 'test query',
          },
        },
        expected: true,
      },
      {
        description: 'should include a time series list query',
        input: {
          queryType: QueryType.TIME_SERIES_LIST,
          timeSeriesList: {
            projectName: 'project',
            filters: ['metric.type', '=', 'cloudsql_database'],
          },
        },
        expected: true,
      },
      {
        description: 'should include an annotation query',
        input: {
          queryType: QueryType.ANNOTATION,
          timeSeriesList: {
            projectName: 'project',
            filters: ['metric.type', '=', 'cloudsql_database'],
          },
        },
        expected: true,
      },
    ].forEach((t) =>
      it(t.description, () => {
        const mockInstanceSettings = createMockInstanceSetttings();
        const ds = new Datasource(mockInstanceSettings);
        const query = { ...t.input } as CloudMonitoringQuery;
        const result = ds.filterQuery(query);
        expect(result).toBe(t.expected);
      })
    );
  });

  describe('getLabels', () => {
    it('should get labels', async () => {
      const mockInstanceSettings = createMockInstanceSetttings();
      const ds = new Datasource(mockInstanceSettings);
      ds.backendSrv = {
        ...ds.backendSrv,
        fetch: jest.fn().mockReturnValue(lastValueFrom(of({ results: [] }))),
      };
      await ds.getLabels('gce_instance', 'A', 'my-project');
      expect(ds.backendSrv.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queries: expect.arrayContaining([
              expect.objectContaining({
                queryType: 'timeSeriesList',
                timeSeriesList: {
                  crossSeriesReducer: 'REDUCE_NONE',
                  filters: ['metric.type', '=', 'gce_instance'],
                  groupBys: [],
                  projectName: 'my-project',
                  view: 'HEADERS',
                },
              }),
            ]),
          }),
        })
      );
    });
  });
});
