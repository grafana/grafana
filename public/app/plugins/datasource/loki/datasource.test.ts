import { of } from 'rxjs';
import { take } from 'rxjs/operators';

import {
  AbstractLabelOperator,
  AnnotationQueryRequest,
  CoreApp,
  CustomVariableModel,
  DataFrame,
  dataFrameToJSON,
  DataQueryResponse,
  DataSourceInstanceSettings,
  dateTime,
  FieldType,
  QueryFixAction,
  SupplementaryQueryType,
  toDataFrame,
  TimeRange,
  ToggleFilterAction,
  DataQueryRequest,
  ScopedVars,
  AdHocVariableFilter,
} from '@grafana/data';
import {
  BackendSrv,
  BackendSrvRequest,
  config,
  FetchResponse,
  getBackendSrv,
  reportInteraction,
  setBackendSrv,
  TemplateSrv,
} from '@grafana/runtime';

import { LokiVariableSupport } from './LokiVariableSupport';
import { LokiDatasource, REF_ID_DATA_SAMPLES } from './datasource';
import { createLokiDatasource } from './mocks/datasource';
import { createMetadataRequest } from './mocks/metadataRequest';
import { runSplitQuery } from './querySplitting';
import { LokiOptions, LokiQuery, LokiQueryType, LokiVariableQueryType, SupportingQueryType } from './types';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
  };
});

jest.mock('./querySplitting');

const templateSrvStub = {
  replace: jest.fn((a: string, ...rest: unknown[]) => a),
} as unknown as TemplateSrv;

const testFrame: DataFrame = {
  refId: 'A',
  fields: [
    {
      name: 'Time',
      type: FieldType.time,
      config: {},
      values: [1, 2],
    },
    {
      name: 'Line',
      type: FieldType.string,
      config: {},
      values: ['line1', 'line2'],
    },
    {
      name: 'labels',
      type: FieldType.other,
      config: {},
      values: [
        {
          label: 'value',
          label2: 'value ',
        },
        {
          label: '',
          label2: 'value2',
          label3: ' ',
        },
      ],
    },
    {
      name: 'tsNs',
      type: FieldType.string,
      config: {},
      values: ['1000000', '2000000'],
    },
    {
      name: 'id',
      type: FieldType.string,
      config: {},
      values: ['id1', 'id2'],
    },
  ],
  length: 2,
};

const testLogsResponse: FetchResponse = {
  data: {
    results: {
      A: {
        frames: [dataFrameToJSON(testFrame)],
      },
    },
  },
  ok: true,
  headers: new Headers(),
  redirected: false,
  status: 200,
  statusText: 'Success',
  type: 'default',
  url: '',
  config: {} as unknown as BackendSrvRequest,
};

const mockTimeRange = {
  from: dateTime(0),
  to: dateTime(1),
  raw: { from: dateTime(0), to: dateTime(1) },
};

const baseRequestOptions = {
  requestId: '',
  interval: '',
  intervalMs: 1,
  range: mockTimeRange,
  scopedVars: {},
  timezone: '',
  app: '',
  startTime: 1,
};

interface AdHocFilter {
  condition: string;
  key: string;
  operator: string;
  value: string;
}

describe('LokiDatasource', () => {
  let origBackendSrv: BackendSrv;

  beforeEach(() => {
    origBackendSrv = getBackendSrv();
  });

  afterEach(() => {
    setBackendSrv(origBackendSrv);
    (reportInteraction as jest.Mock).mockClear();
  });

  describe('when doing logs queries with limits', () => {
    const runTest = async (
      queryMaxLines: number | undefined,
      dsMaxLines: string | undefined,
      expectedMaxLines: number,
      app: CoreApp | undefined
    ) => {
      const settings = {
        jsonData: {
          maxLines: dsMaxLines,
        },
      } as DataSourceInstanceSettings<LokiOptions>;

      const ds = createLokiDatasource(templateSrvStub, settings);

      // we need to check the final query before it is sent out,
      // and applyTemplateVariables is a convenient place to do that.
      const spy = jest.spyOn(ds, 'applyTemplateVariables');

      const options: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [{ expr: '{a="b"}', refId: 'B', maxLines: queryMaxLines }],
        app: app ?? CoreApp.Dashboard,
      };

      const fetchMock = jest.fn().mockReturnValue(of({ data: testLogsResponse }));
      setBackendSrv({ ...origBackendSrv, fetch: fetchMock });

      await expect(ds.query(options).pipe(take(1))).toEmitValuesWith(() => {
        expect(fetchMock.mock.calls.length).toBe(1);
        expect(spy.mock.calls[0][0].maxLines).toBe(expectedMaxLines);
      });
    };

    it('should use datasource max lines when no query max lines', async () => {
      await runTest(undefined, '40', 40, undefined);
    });

    it('should use query max lines, if exists', async () => {
      await runTest(80, undefined, 80, undefined);
    });

    it('should use query max lines, if both exist, even if it is higher than ds max lines', async () => {
      await runTest(80, '40', 80, undefined);
    });

    it('should use query max lines, if both exist, even if it is 0', async () => {
      await runTest(0, '40', 0, undefined);
    });

    it('should report query interaction', async () => {
      await runTest(80, '40', 80, CoreApp.Explore);
      expect(reportInteraction).toHaveBeenCalledWith(
        'grafana_explore_loki_query_executed',
        expect.objectContaining({
          query_type: 'logs',
          line_limit: 80,
          obfuscated_query: '{Identifier=String}',
        })
      );
    });

    it('should not report query interaction for dashboard query', async () => {
      await runTest(80, '40', 80, CoreApp.Dashboard);
      expect(reportInteraction).not.toBeCalled();
    });

    it('should not report query interaction for unknown app query', async () => {
      await runTest(80, '40', 80, CoreApp.Unknown);
      expect(reportInteraction).not.toBeCalled();
    });
  });

  describe('When using adhoc filters', () => {
    const DEFAULT_EXPR = 'rate({bar="baz", job="foo"} |= "bar" [5m])';
    const query: LokiQuery = { expr: DEFAULT_EXPR, refId: 'A' };
    const ds = createLokiDatasource(templateSrvStub);

    it('should not modify expression with no filters', async () => {
      expect(ds.applyTemplateVariables(query, {}).expr).toBe(DEFAULT_EXPR);
    });

    it('should add filters to expression', async () => {
      const adhocFilters = [
        {
          key: 'k1',
          operator: '=',
          value: 'v1',
        },
        {
          key: 'k2',
          operator: '!=',
          value: 'v2',
        },
      ];

      expect(ds.applyTemplateVariables(query, {}, adhocFilters).expr).toBe(
        'rate({bar="baz", job="foo", k1="v1", k2!="v2"} |= "bar" [5m])'
      );
    });

    it('should add escaping if needed to regex filter expressions', async () => {
      const adhocFilters = [
        {
          key: 'k1',
          operator: '=~',
          value: 'v.*',
        },
        {
          key: 'k2',
          operator: '=~',
          value: `v'.*`,
        },
      ];
      expect(ds.applyTemplateVariables(query, {}, adhocFilters).expr).toBe(
        `rate({bar="baz", job="foo", k1=~"v.*", k2=~"v'.*"} |= "bar" [5m])`
      );
    });

    it('should interpolate before adding adhoc filters', async () => {
      const originalQuery = 'rate({bar="baz", job="foo"} |= "bar" [$__auto])';
      const interpolatedQuery = 'rate({bar="baz", job="foo"} |= "bar" [5m])';
      const templateSrv = {
        replace: jest.fn().mockImplementation((input: string) => interpolatedQuery),
        getVariables: () => [],
      };
      const query: LokiQuery = { expr: originalQuery, refId: 'A' };
      const ds = createLokiDatasource(templateSrv);
      const adhocFilters: AdHocFilter[] = [
        {
          key: 'k1',
          operator: '=',
          value: 'v1',
          condition: '',
        },
        {
          key: 'k2',
          operator: '!=',
          value: 'v2',
          condition: '',
        },
      ];
      jest.spyOn(ds, 'addAdHocFilters');

      ds.applyTemplateVariables(query, {}, adhocFilters);

      expect(templateSrv.replace).toHaveBeenCalledWith(originalQuery, expect.any(Object), expect.any(Function));
      expect(ds.addAdHocFilters).toHaveBeenCalledWith(interpolatedQuery, adhocFilters);

      expect(ds.applyTemplateVariables(query, {}, adhocFilters).expr).toBe(
        'rate({bar="baz", job="foo", k1="v1", k2!="v2"} |= "bar" [5m])'
      );

      assertAdHocFilters(
        originalQuery,
        'rate({bar="baz", job="foo", k1="v1", k2!="v2"} |= "bar" [$__auto])',
        ds,
        adhocFilters
      );
    });
  });

  describe('when interpolating variables', () => {
    let ds: LokiDatasource;
    let variable: CustomVariableModel;

    beforeEach(() => {
      ds = createLokiDatasource(templateSrvStub);
      variable = {} as unknown as CustomVariableModel;
    });

    it('should not escape', () => {
      expect(ds.interpolateQueryExpr("abc'$^*{}[]+?.()|", variable)).toEqual("abc'$^*{}[]+?.()|");
    });

    it('should not escape single quotes in line filters', () => {
      expect(ds.interpolateQueryExpr("|= `abc'$^*{}[]+?.()|`", variable)).toEqual("|= `abc'$^*{}[]+?.()|`");
      expect(ds.interpolateQueryExpr("|~ `abc'$^*{}[]+?.()|`", variable)).toEqual("|~ `abc'$^*{}[]+?.()|`");
      expect(ds.interpolateQueryExpr("!= `abc'$^*{}[]+?.()|`", variable)).toEqual("!= `abc'$^*{}[]+?.()|`");
      expect(ds.interpolateQueryExpr("!~ `abc'$^*{}[]+?.()|`", variable)).toEqual("!~ `abc'$^*{}[]+?.()|`");
    });

    it('should return a number', () => {
      expect(ds.interpolateQueryExpr(1000, variable)).toEqual(1000);
    });

    describe('and variable allows multi-value', () => {
      beforeEach(() => {
        variable.multi = true;
      });

      it('should regex escape values if the value is a string', () => {
        expect(ds.interpolateQueryExpr('looking*glass', variable)).toEqual('looking\\\\*glass');
      });

      it('should return pipe separated values if the value is an array of strings', () => {
        expect(ds.interpolateQueryExpr(['a|bc', 'de|f'], variable)).toEqual('a\\\\|bc|de\\\\|f');
      });
    });

    describe('and variable allows all', () => {
      beforeEach(() => {
        variable.includeAll = true;
      });

      it('should regex escape values if the array is a string', () => {
        expect(ds.interpolateQueryExpr('looking*glass', variable)).toEqual('looking\\\\*glass');
      });

      it('should return pipe separated values if the value is an array of strings', () => {
        expect(ds.interpolateQueryExpr(['a|bc', 'de|f'], variable)).toEqual('a\\\\|bc|de\\\\|f');
      });
    });
  });

  describe('when running interpolateVariablesInQueries', () => {
    it('should call addAdHocFilters', () => {
      const ds = createLokiDatasource(templateSrvStub);
      ds.addAdHocFilters = jest.fn();
      const expr = 'rate({bar="baz", job="foo"} [5m]';
      const queries = [
        {
          refId: 'A',
          expr,
        },
      ];
      ds.interpolateVariablesInQueries(queries, {}, []);
      expect(ds.addAdHocFilters).toHaveBeenCalledWith(expr, []);
    });
  });

  describe('when calling annotationQuery', () => {
    const getTestContext = (frame: DataFrame, options = {}) => {
      const query = makeAnnotationQueryRequest(options);

      const ds = createLokiDatasource(templateSrvStub);
      const response: DataQueryResponse = {
        data: [frame],
      };
      ds.query = () => of(response);
      return ds.annotationQuery(query);
    };

    it('should transform the loki data to annotation response', async () => {
      const testFrame: DataFrame = {
        refId: 'A',
        fields: [
          {
            name: 'Time',
            type: FieldType.time,
            config: {},
            values: [1, 2],
          },
          {
            name: 'Line',
            type: FieldType.string,
            config: {},
            values: ['hello', 'hello 2'],
          },
          {
            name: 'labels',
            type: FieldType.other,
            config: {},
            values: [
              {
                label: 'value',
                label2: 'value ',
              },
              {
                label: '',
                label2: 'value2',
                label3: ' ',
              },
            ],
          },
          {
            name: 'tsNs',
            type: FieldType.string,
            config: {},
            values: ['1000000', '2000000'],
          },
          {
            name: 'id',
            type: FieldType.string,
            config: {},
            values: ['id1', 'id2'],
          },
        ],
        length: 2,
      };
      const res = await getTestContext(testFrame, { stepInterval: '15s' });

      expect(res.length).toBe(2);
      expect(res[0].text).toBe('hello');
      expect(res[0].tags).toEqual(['value']);
      expect(res[0].time).toEqual(1);

      expect(res[1].text).toBe('hello 2');
      expect(res[1].tags).toEqual(['value2']);
      expect(res[1].time).toEqual(2);
    });

    it('should transform the loki dataplane data to annotation response', async () => {
      const originalDataplaneState = config.featureToggles.lokiLogsDataplane;
      config.featureToggles.lokiLogsDataplane = true;
      const testFrame: DataFrame = {
        refId: 'A',
        fields: [
          {
            name: 'timestamp',
            type: FieldType.time,
            config: {},
            values: [1, 2],
          },
          {
            name: 'body',
            type: FieldType.string,
            config: {},
            values: ['hello', 'hello 2'],
          },
          {
            name: 'labels',
            type: FieldType.other,
            config: {},
            values: [
              {
                label: 'value',
                label2: 'value ',
              },
              {
                label: '',
                label2: 'value2',
                label3: ' ',
              },
            ],
          },
          {
            name: 'tsNs',
            type: FieldType.string,
            config: {},
            values: ['1000000', '2000000'],
          },
          {
            name: 'id',
            type: FieldType.string,
            config: {},
            values: ['id1', 'id2'],
          },
        ],
        length: 2,
      };
      const res = await getTestContext(testFrame, { stepInterval: '15s' });

      expect(res.length).toBe(2);
      expect(res[0].text).toBe('hello');
      expect(res[0].tags).toEqual(['value']);
      expect(res[0].time).toEqual(1);

      expect(res[1].text).toBe('hello 2');
      expect(res[1].tags).toEqual(['value2']);
      expect(res[1].time).toEqual(2);

      config.featureToggles.lokiLogsDataplane = originalDataplaneState;
    });

    describe('Formatting', () => {
      const testFrame: DataFrame = {
        refId: 'A',
        fields: [
          {
            name: 'Time',
            type: FieldType.time,
            config: {},
            values: [1],
          },
          {
            name: 'Line',
            type: FieldType.string,
            config: {},
            values: ['hello'],
          },
          {
            name: 'labels',
            type: FieldType.other,
            config: {},
            values: [
              {
                label: 'value',
                label2: 'value2',
                label3: 'value3',
              },
            ],
          },
          {
            name: 'tsNs',
            type: FieldType.string,
            config: {},
            values: ['1000000'],
          },
          {
            name: 'id',
            type: FieldType.string,
            config: {},
            values: ['id1'],
          },
        ],
        length: 1,
      };
      describe('When tagKeys is set', () => {
        it('should only include selected labels', async () => {
          const res = await getTestContext(testFrame, { tagKeys: 'label2,label3', stepInterval: '15s' });

          expect(res.length).toBe(1);
          expect(res[0].text).toBe('hello');
          expect(res[0].tags).toEqual(['value2', 'value3']);
        });
      });
      describe('When textFormat is set', () => {
        it('should format the text accordingly', async () => {
          const res = await getTestContext(testFrame, { textFormat: 'hello {{label2}}', stepInterval: '15s' });

          expect(res.length).toBe(1);
          expect(res[0].text).toBe('hello value2');
        });
      });
      describe('When titleFormat is set', () => {
        it('should format the title accordingly', async () => {
          const res = await getTestContext(testFrame, { titleFormat: 'Title {{label2}}', stepInterval: '15s' });

          expect(res.length).toBe(1);
          expect(res[0].title).toBe('Title value2');
          expect(res[0].text).toBe('hello');
        });
      });
    });
  });

  describe('metricFindQuery', () => {
    const getTestContext = () => {
      const ds = createLokiDatasource(templateSrvStub);
      jest
        .spyOn(ds, 'metadataRequest')
        .mockImplementation(
          createMetadataRequest(
            { label1: ['value1', 'value2'], label2: ['value3', 'value4'] },
            { '{label1="value1", label2="value2"}': [{ label5: 'value5' }] }
          )
        );

      return { ds };
    };

    it('should return empty array if label values returns empty', async () => {
      const ds = createLokiDatasource(templateSrvStub);
      const spy = jest.spyOn(ds.languageProvider, 'fetchLabelValues').mockResolvedValue([]);

      const result = await ds.metricFindQuery({
        refId: 'test',
        type: LokiVariableQueryType.LabelValues,
        stream: '{label1="value1"}',
        label: 'label2',
      });

      expect(result).toEqual([]);
      spy.mockClear();
    });

    it('should return label names for Loki', async () => {
      const { ds } = getTestContext();

      const legacyResult = await ds.metricFindQuery('label_names()');
      const result = await ds.metricFindQuery({ refId: 'test', type: LokiVariableQueryType.LabelNames });

      expect(legacyResult).toEqual(result);
      expect(result).toEqual([{ text: 'label1' }, { text: 'label2' }]);
    });

    it('should return label values for Loki when no matcher', async () => {
      const { ds } = getTestContext();

      const legacyResult = await ds.metricFindQuery('label_values(label1)');
      const result = await ds.metricFindQuery({
        refId: 'test',
        type: LokiVariableQueryType.LabelValues,
        label: 'label1',
      });

      expect(legacyResult).toEqual(result);
      expect(result).toEqual([{ text: 'value1' }, { text: 'value2' }]);
    });

    it('should return label values for Loki with matcher', async () => {
      const { ds } = getTestContext();

      const legacyResult = await ds.metricFindQuery('label_values({label1="value1", label2="value2"},label5)');
      const result = await ds.metricFindQuery({
        refId: 'test',
        type: LokiVariableQueryType.LabelValues,
        stream: '{label1="value1", label2="value2"}',
        label: 'label5',
      });

      expect(legacyResult).toEqual(result);
      expect(result).toEqual([{ text: 'value5' }]);
    });

    it('should return empty array when incorrect query for Loki', async () => {
      const { ds } = getTestContext();

      const result = await ds.metricFindQuery('incorrect_query');

      expect(result).toEqual([]);
    });

    it('should interpolate strings in the query', async () => {
      const { ds } = getTestContext();
      const scopedVars = { scopedVar1: { value: 'A' } };

      await ds.metricFindQuery('label_names()', { scopedVars });
      await ds.metricFindQuery(
        {
          refId: 'test',
          type: LokiVariableQueryType.LabelValues,
          stream: '{label1="value1", label2="value2"}',
          label: 'label5',
        },
        { scopedVars }
      );

      expect(templateSrvStub.replace).toHaveBeenCalledWith('label_names()', scopedVars, expect.any(Function));
      expect(templateSrvStub.replace).toHaveBeenCalledWith(
        '{label1="value1", label2="value2"}',
        scopedVars,
        expect.any(Function)
      );
      expect(templateSrvStub.replace).toHaveBeenCalledWith('label5', scopedVars, expect.any(Function));
    });
  });

  describe('modifyQuery', () => {
    const frameWithTypes = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [0] },
        {
          name: 'Line',
          type: FieldType.string,
          values: ['line1'],
        },
        { name: 'labelTypes', type: FieldType.other, values: [{ indexed: 'I', parsed: 'P', structured: 'S' }] },
      ],
    });
    const frameWithoutTypes = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [0] },
        {
          name: 'Line',
          type: FieldType.string,
          values: ['line1'],
        },
        { name: 'labels', type: FieldType.other, values: [{ job: 'test' }] },
      ],
    });
    describe('when called with ADD_FILTER', () => {
      let ds: LokiDatasource;
      beforeEach(() => {
        ds = createLokiDatasource(templateSrvStub);
        ds.languageProvider.labelKeys = ['bar', 'job'];
      });

      describe('and query has no parser', () => {
        it('then the correct label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
          const action = { options: { key: 'job', value: 'grafana' }, type: 'ADD_FILTER' };
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz", job="grafana"}');
        });

        it('then the correctly escaped label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
          const action = { options: { key: 'job', value: '\\test' }, type: 'ADD_FILTER' };
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz", job="\\\\test"}');
        });

        it('then the correct label should be added for metrics query', () => {
          const query: LokiQuery = { refId: 'A', expr: 'rate({bar="baz"}[5m])' };
          const action = { options: { key: 'job', value: 'grafana' }, type: 'ADD_FILTER' };
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('rate({bar="baz", job="grafana"}[5m])');
        });

        describe('with a frame with label types', () => {
          it('then the correct structured metadata label should be added as LabelFilter', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };

            const action: QueryFixAction = {
              options: { key: 'structured', value: 'foo' },
              type: 'ADD_FILTER',
              frame: frameWithTypes,
            };
            ds.languageProvider.labelKeys = ['bar'];
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz"} | structured=`foo`');
          });

          it('then the correct parsed label should be added as LabelFilter', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };

            const action: QueryFixAction = {
              options: { key: 'parsed', value: 'foo' },
              type: 'ADD_FILTER',
              frame: frameWithTypes,
            };
            ds.languageProvider.labelKeys = ['bar'];
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz"} | parsed=`foo`');
          });

          it('then the correct indexed label should be added as LabelFilter', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };

            const action: QueryFixAction = {
              options: { key: 'indexed', value: 'foo' },
              type: 'ADD_FILTER',
              frame: frameWithTypes,
            };
            ds.languageProvider.labelKeys = ['bar'];
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz", indexed="foo"}');
          });

          it('then the correct structured metadata label should be added as LabelFilter with parser', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | json' };

            const action: QueryFixAction = {
              options: { key: 'structured', value: 'foo' },
              type: 'ADD_FILTER',
              frame: frameWithTypes,
            };
            ds.languageProvider.labelKeys = ['bar'];
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz"} | json | structured=`foo`');
          });

          it('then the correct parsed label should be added as LabelFilter with parser', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | json' };

            const action: QueryFixAction = {
              options: { key: 'parsed', value: 'foo' },
              type: 'ADD_FILTER',
              frame: frameWithTypes,
            };
            ds.languageProvider.labelKeys = ['bar'];
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz"} | json | parsed=`foo`');
          });

          it('then the correct indexed label should be added as LabelFilter with parser', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | json' };

            const action: QueryFixAction = {
              options: { key: 'indexed', value: 'foo' },
              type: 'ADD_FILTER',
              frame: frameWithTypes,
            };
            ds.languageProvider.labelKeys = ['bar'];
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz", indexed="foo"} | json');
          });
        });
        describe('with a frame without label types', () => {
          it('then the correct structured metadata label should be added as LabelFilter', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };

            const action: QueryFixAction = {
              options: { key: 'structured', value: 'foo' },
              type: 'ADD_FILTER',
              frame: frameWithoutTypes,
            };
            ds.languageProvider.labelKeys = ['bar'];
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz", structured="foo"}');
          });

          it('then the correct parsed label should be added to the stream selector', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };

            const action: QueryFixAction = {
              options: { key: 'parsed', value: 'foo' },
              type: 'ADD_FILTER',
              frame: frameWithoutTypes,
            };
            ds.languageProvider.labelKeys = ['bar'];
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz", parsed="foo"}');
          });

          it('then the correct indexed label should be added as LabelFilter', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };

            const action: QueryFixAction = {
              options: { key: 'indexed', value: 'foo' },
              type: 'ADD_FILTER',
              frame: frameWithoutTypes,
            };
            ds.languageProvider.labelKeys = ['bar'];
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz", indexed="foo"}');
          });
          it('then the correct structured metadata label should be added as LabelFilter with parser', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | json' };

            const action: QueryFixAction = {
              options: { key: 'structured', value: 'foo' },
              type: 'ADD_FILTER',
              frame: frameWithoutTypes,
            };
            ds.languageProvider.labelKeys = ['bar'];
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz"} | json | structured=`foo`');
          });

          it('then the correct parsed label should be added as LabelFilter with parser', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | json' };

            const action: QueryFixAction = {
              options: { key: 'parsed', value: 'foo' },
              type: 'ADD_FILTER',
              frame: frameWithoutTypes,
            };
            ds.languageProvider.labelKeys = ['bar'];
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz"} | json | parsed=`foo`');
          });

          it('then the correct indexed label should be added as LabelFilter with parser', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | json' };

            const action: QueryFixAction = {
              options: { key: 'indexed', value: 'foo' },
              type: 'ADD_FILTER',
              frame: frameWithoutTypes,
            };
            ds.languageProvider.labelKeys = ['bar'];
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz"} | json | indexed=`foo`');
          });
        });
      });
      describe('and query has parser', () => {
        it('then the correct label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | logfmt' };
          const action = { options: { key: 'job', value: 'grafana' }, type: 'ADD_FILTER' };
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz"} | logfmt | job=`grafana`');
        });
        it('then the correct label should be added for metrics query', () => {
          const query: LokiQuery = { refId: 'A', expr: 'rate({bar="baz"} | logfmt [5m])' };
          const action = { options: { key: 'job', value: 'grafana' }, type: 'ADD_FILTER' };
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('rate({bar="baz"} | logfmt | job=`grafana` [5m])');
        });
      });
    });

    describe('when called with ADD_FILTER_OUT', () => {
      let ds: LokiDatasource;
      beforeEach(() => {
        ds = createLokiDatasource(templateSrvStub);
        ds.languageProvider.labelKeys = ['bar', 'job'];
      });
      describe('and query has no parser', () => {
        it('then the correct label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
          const action = { options: { key: 'job', value: 'grafana' }, type: 'ADD_FILTER_OUT' };
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz", job!="grafana"}');
        });

        it('then the correctly escaped label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
          const action = { options: { key: 'job', value: '"test' }, type: 'ADD_FILTER_OUT' };
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz", job!="\\"test"}');
        });

        it('then the correct label should be added for metrics query', () => {
          const query: LokiQuery = { refId: 'A', expr: 'rate({bar="baz"}[5m])' };
          const action = { options: { key: 'job', value: 'grafana' }, type: 'ADD_FILTER_OUT' };
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('rate({bar="baz", job!="grafana"}[5m])');
        });
      });
      describe('and query has parser', () => {
        let ds: LokiDatasource;
        beforeEach(() => {
          ds = createLokiDatasource(templateSrvStub);
          ds.languageProvider.labelKeys = ['bar', 'job'];
        });

        it('then the correct label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | logfmt' };
          const action = { options: { key: 'job', value: 'grafana' }, type: 'ADD_FILTER_OUT' };
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz"} | logfmt | job!=`grafana`');
        });
        it('then the correct label should be added for metrics query', () => {
          const query: LokiQuery = { refId: 'A', expr: 'rate({bar="baz"} | logfmt [5m])' };
          const action = { options: { key: 'job', value: 'grafana' }, type: 'ADD_FILTER_OUT' };
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('rate({bar="baz"} | logfmt | job!=`grafana` [5m])');
        });
      });
    });

    describe('when called with ADD_LINE_FILTER', () => {
      let ds: LokiDatasource;
      const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
      beforeEach(() => {
        ds = createLokiDatasource(templateSrvStub);
        ds.languageProvider.labelKeys = ['bar', 'job'];
      });

      it('adds a line filter', () => {
        const action = { options: {}, type: 'ADD_LINE_FILTER' };
        const result = ds.modifyQuery(query, action);

        expect(result.expr).toEqual('{bar="baz"} |= ``');
      });
      it('adds a line filter with a value', () => {
        const action = { options: { value: 'value' }, type: 'ADD_LINE_FILTER' };
        const result = ds.modifyQuery(query, action);

        expect(result.expr).toEqual('{bar="baz"} |= `value`');
      });
    });

    describe('when called with ADD_LINE_FILTER_OUT', () => {
      let ds: LokiDatasource;
      const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
      beforeEach(() => {
        ds = createLokiDatasource(templateSrvStub);
        ds.languageProvider.labelKeys = ['bar', 'job'];
      });

      it('adds a line filter', () => {
        const action = { options: {}, type: 'ADD_LINE_FILTER_OUT' };
        const result = ds.modifyQuery(query, action);

        expect(result.expr).toEqual('{bar="baz"} != ``');
      });
      it('adds a line filter with a value', () => {
        const action = { options: { value: 'value' }, type: 'ADD_LINE_FILTER_OUT' };
        const result = ds.modifyQuery(query, action);

        expect(result.expr).toEqual('{bar="baz"} != `value`');
      });
    });
  });

  describe('toggleQueryFilter', () => {
    describe('when called with FILTER', () => {
      let ds: LokiDatasource;
      beforeEach(() => {
        ds = createLokiDatasource(templateSrvStub);
      });

      describe('and query has no parser', () => {
        it('then the correct label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
          const action: ToggleFilterAction = { options: { key: 'job', value: 'grafana' }, type: 'FILTER_FOR' };
          const result = ds.toggleQueryFilter(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz", job="grafana"}');
        });

        it('then the correctly escaped label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
          const action: ToggleFilterAction = { options: { key: 'job', value: '\\test' }, type: 'FILTER_FOR' };
          const result = ds.toggleQueryFilter(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz", job="\\\\test"}');
        });

        it('then the correct label should be added for metrics query', () => {
          const query: LokiQuery = { refId: 'A', expr: 'rate({bar="baz"}[5m])' };
          const action: ToggleFilterAction = { options: { key: 'job', value: 'grafana' }, type: 'FILTER_FOR' };
          const result = ds.toggleQueryFilter(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('rate({bar="baz", job="grafana"}[5m])');
        });

        describe('and the filter is already present', () => {
          it('then it should remove the filter', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz", job="grafana"}' };
            const action: ToggleFilterAction = { options: { key: 'job', value: 'grafana' }, type: 'FILTER_FOR' };
            const result = ds.toggleQueryFilter(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz"}');
          });

          it('then it should remove the filter with escaped value', () => {
            const query: LokiQuery = { refId: 'A', expr: '{place="luna", job="\\"grafana/data\\""}' };
            const action: ToggleFilterAction = { options: { key: 'job', value: '"grafana/data"' }, type: 'FILTER_FOR' };
            const result = ds.toggleQueryFilter(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{place="luna"}');
          });
        });
      });

      describe('and query has parser', () => {
        it('then the correct label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | logfmt' };
          const action: ToggleFilterAction = { options: { key: 'job', value: 'grafana' }, type: 'FILTER_FOR' };
          const result = ds.toggleQueryFilter(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz"} | logfmt | job=`grafana`');
        });

        it('then the correct label should be added for metrics query', () => {
          const query: LokiQuery = { refId: 'A', expr: 'rate({bar="baz"} | logfmt [5m])' };
          const action: ToggleFilterAction = { options: { key: 'job', value: 'grafana' }, type: 'FILTER_FOR' };
          const result = ds.toggleQueryFilter(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('rate({bar="baz"} | logfmt | job=`grafana` [5m])');
        });

        describe('and the filter is already present', () => {
          it('then it should remove the filter', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | logfmt | job="grafana"' };
            const action: ToggleFilterAction = { options: { key: 'job', value: 'grafana' }, type: 'FILTER_FOR' };
            const result = ds.toggleQueryFilter(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz"} | logfmt');
          });
        });
      });
    });

    describe('when called with FILTER_OUT', () => {
      describe('and query has no parser', () => {
        let ds: LokiDatasource;
        beforeEach(() => {
          ds = createLokiDatasource(templateSrvStub);
        });

        it('then the correct label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
          const action: ToggleFilterAction = { options: { key: 'job', value: 'grafana' }, type: 'FILTER_OUT' };
          const result = ds.toggleQueryFilter(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz", job!="grafana"}');
        });

        it('then the correctly escaped label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
          const action: ToggleFilterAction = { options: { key: 'job', value: '"test' }, type: 'FILTER_OUT' };
          const result = ds.toggleQueryFilter(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz", job!="\\"test"}');
        });

        it('then the correct label should be added for metrics query', () => {
          const query: LokiQuery = { refId: 'A', expr: 'rate({bar="baz"}[5m])' };
          const action: ToggleFilterAction = { options: { key: 'job', value: 'grafana' }, type: 'FILTER_OUT' };
          const result = ds.toggleQueryFilter(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('rate({bar="baz", job!="grafana"}[5m])');
        });

        describe('and the opposite filter is present', () => {
          it('then it should remove the filter', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz", job="grafana"}' };
            const action: ToggleFilterAction = { options: { key: 'job', value: 'grafana' }, type: 'FILTER_OUT' };
            const result = ds.toggleQueryFilter(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz", job!="grafana"}');
          });
        });
      });

      describe('and query has parser', () => {
        let ds: LokiDatasource;
        beforeEach(() => {
          ds = createLokiDatasource(templateSrvStub);
        });

        it('then the correct label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | logfmt' };
          const action: ToggleFilterAction = { options: { key: 'job', value: 'grafana' }, type: 'FILTER_OUT' };
          const result = ds.toggleQueryFilter(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz"} | logfmt | job!=`grafana`');
        });

        it('then the correct label should be added for metrics query', () => {
          const query: LokiQuery = { refId: 'A', expr: 'rate({bar="baz"} | logfmt [5m])' };
          const action: ToggleFilterAction = { options: { key: 'job', value: 'grafana' }, type: 'FILTER_OUT' };
          const result = ds.toggleQueryFilter(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('rate({bar="baz"} | logfmt | job!=`grafana` [5m])');
        });

        describe('and the filter is already present', () => {
          it('then it should remove the filter', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | logfmt | job="grafana"' };
            const action: ToggleFilterAction = { options: { key: 'job', value: 'grafana' }, type: 'FILTER_OUT' };
            const result = ds.toggleQueryFilter(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz"} | logfmt | job!=`grafana`');
          });
        });
      });
    });
  });

  describe('addAdHocFilters', () => {
    let ds: LokiDatasource;
    describe('when called with "=" operator', () => {
      beforeEach(() => {
        ds = createLokiDatasource();
      });
      const defaultAdHocFilters: AdHocFilter[] = [
        {
          condition: '',
          key: 'job',
          operator: '=',
          value: 'grafana',
        },
      ];
      describe('and query has no parser', () => {
        it('then the correct label should be added for logs query', () => {
          assertAdHocFilters('{bar="baz"}', '{bar="baz", job="grafana"}', ds, defaultAdHocFilters);
        });

        it('then the correct label should be added for metrics query', () => {
          assertAdHocFilters('rate({bar="baz"}[5m])', 'rate({bar="baz", job="grafana"}[5m])', ds, defaultAdHocFilters);
        });

        it('then the correct label should be added for metrics query and variable', () => {
          assertAdHocFilters(
            'rate({bar="baz"}[$__interval])',
            'rate({bar="baz", job="grafana"}[$__interval])',
            ds,
            defaultAdHocFilters
          );
        });

        it('then the correct label should be added for logs query with empty selector', () => {
          assertAdHocFilters('{}', '{job="grafana"}', ds, defaultAdHocFilters);
        });

        it('then the correct label should be added for metrics query with empty selector', () => {
          assertAdHocFilters('rate({}[5m])', 'rate({job="grafana"}[5m])', ds, defaultAdHocFilters);
        });

        it('then the correct label should be added for metrics query with empty selector and variable', () => {
          assertAdHocFilters('rate({}[$__interval])', 'rate({job="grafana"}[$__interval])', ds, defaultAdHocFilters);
        });
        it('should correctly escape special characters in ad hoc filter', () => {
          assertAdHocFilters('{job="grafana"}', '{job="grafana", instance="\\"test\\""}', ds, [
            {
              condition: '',
              key: 'instance',
              operator: '=',
              value: '"test"',
            },
          ]);
        });
      });
      describe('and query has parser', () => {
        it('then the correct label should be added for logs query', () => {
          assertAdHocFilters('{bar="baz"} | logfmt', '{bar="baz"} | logfmt | job=`grafana`', ds, defaultAdHocFilters);
        });
        it('then the correct label should be added for metrics query', () => {
          assertAdHocFilters(
            'rate({bar="baz"} | logfmt [5m])',
            'rate({bar="baz"} | logfmt | job=`grafana` [5m])',
            ds,
            defaultAdHocFilters
          );
        });
        it('should add the filter after other label filters', () => {
          assertAdHocFilters(
            '{bar="baz"} | logfmt | test="value" | line_format "test"',
            '{bar="baz"} | logfmt | test="value" | job=`grafana` | line_format "test"',
            ds,
            defaultAdHocFilters
          );
        });
        it('should add the filter after label_format', () => {
          assertAdHocFilters(
            '{bar="baz"} | logfmt | test="value" | label_format process="{{.process}}"',
            '{bar="baz"} | logfmt | test="value" | label_format process="{{.process}}" | job=`grafana`',
            ds,
            defaultAdHocFilters
          );
        });
      });
    });

    describe('when called with "!=" operator', () => {
      const defaultAdHocFilters: AdHocFilter[] = [
        {
          condition: '',
          key: 'job',
          operator: '!=',
          value: 'grafana',
        },
      ];
      beforeEach(() => {
        ds = createLokiDatasource();
      });
      describe('and query has no parser', () => {
        it('then the correct label should be added for logs query', () => {
          assertAdHocFilters('{bar="baz"}', '{bar="baz", job!="grafana"}', ds, defaultAdHocFilters);
        });

        it('then the correct label should be added for metrics query', () => {
          assertAdHocFilters('rate({bar="baz"}[5m])', 'rate({bar="baz", job!="grafana"}[5m])', ds, defaultAdHocFilters);
        });
      });
      describe('and query has parser', () => {
        it('then the correct label should be added for logs query', () => {
          assertAdHocFilters('{bar="baz"} | logfmt', '{bar="baz"} | logfmt | job!=`grafana`', ds, defaultAdHocFilters);
        });
        it('then the correct label should be added for metrics query', () => {
          assertAdHocFilters(
            'rate({bar="baz"} | logfmt [5m])',
            'rate({bar="baz"} | logfmt | job!=`grafana` [5m])',
            ds,
            defaultAdHocFilters
          );
        });
      });
    });

    describe('when called with regex operator', () => {
      const defaultAdHocFilters: AdHocFilter[] = [
        {
          condition: '',
          key: 'instance',
          operator: '=~',
          value: '.*',
        },
      ];
      beforeEach(() => {
        ds = createLokiDatasource();
      });
      it('should not escape special characters in ad hoc filter', () => {
        assertAdHocFilters('{job="grafana"}', '{job="grafana", instance=~".*"}', ds, defaultAdHocFilters);
      });
    });

    describe('bug', () => {
      beforeEach(() => {
        ds = createLokiDatasource();
      });
      const defaultAdHocFilters: AdHocFilter[] = [
        {
          key: 'service_name',
          operator: '=',
          value: 'grafana/hosted-grafana-gateway',
          condition: '',
        },
      ];
      it('should not add indexed fields twice as index filter and line filter, backtick', () => {
        assertAdHocFilters(
          '{service_name=`grafana/hosted-grafana-gateway`} | logfmt',
          '{service_name="grafana/hosted-grafana-gateway"} | logfmt',
          ds,
          defaultAdHocFilters
        );
      });
      it('should not add indexed fields twice as index filter and line filter, quotes', () => {
        assertAdHocFilters(
          '{service_name="grafana/hosted-grafana-gateway"} | logfmt',
          '{service_name="grafana/hosted-grafana-gateway"} | logfmt',
          ds,
          defaultAdHocFilters
        );
      });
    });
  });

  describe('logs volume data provider', () => {
    let ds: LokiDatasource;
    beforeEach(() => {
      ds = createLokiDatasource(templateSrvStub);
    });

    it('creates provider for logs query', () => {
      const options: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [{ expr: '{label="value"}', refId: 'A', queryType: LokiQueryType.Range }],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsVolume, options)).toBeDefined();
    });

    it('does not create provider for hidden logs query', () => {
      const options: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [{ expr: '{label="value"}', refId: 'A', queryType: LokiQueryType.Range, hide: true }],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsVolume, options)).not.toBeDefined();
    });

    it('does not create provider for metrics query', () => {
      const options: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [{ expr: 'rate({label="value"}[1m])', refId: 'A' }],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsVolume, options)).not.toBeDefined();
    });

    it('creates provider if at least one query is a logs query', () => {
      const options: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [
          { expr: 'rate({label="value"}[1m])', queryType: LokiQueryType.Range, refId: 'A' },
          { expr: '{label="value"}', queryType: LokiQueryType.Range, refId: 'B' },
        ],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsVolume, options)).toBeDefined();
    });

    it('does create provider if there is only an instant logs query', () => {
      // we changed logic to automatically run logs queries as range queries, thus there's a provider now
      const options: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [{ expr: '{label="value"', refId: 'A', queryType: LokiQueryType.Instant }],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsVolume, options)).toBeDefined();
    });
  });

  describe('logs sample data provider', () => {
    let ds: LokiDatasource;
    beforeEach(() => {
      ds = createLokiDatasource(templateSrvStub);
    });

    it('creates provider for metrics query', () => {
      const options: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [{ expr: 'rate({label="value"}[5m])', refId: 'A' }],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsSample, options)).toBeDefined();
    });

    it('does not create provider for log query', () => {
      const options: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [{ expr: '{label="value"}', refId: 'A' }],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsSample, options)).not.toBeDefined();
    });

    it('creates provider if at least one query is a metric query', () => {
      const options: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [
          { expr: 'rate({label="value"}[1m])', refId: 'A' },
          { expr: '{label="value"}', refId: 'B' },
        ],
      };

      expect(ds.getSupplementaryRequest(SupplementaryQueryType.LogsSample, options)).toBeDefined();
    });
  });

  describe('getSupplementaryQuery', () => {
    let ds: LokiDatasource;
    beforeEach(() => {
      ds = createLokiDatasource(templateSrvStub);
    });

    describe('logs volume', () => {
      // The default queryType value is Range
      it('returns logs volume for query with no queryType', () => {
        expect(
          ds.getSupplementaryQuery(
            { type: SupplementaryQueryType.LogsVolume },
            {
              expr: '{label="value"}',
              refId: 'A',
            }
          )
        ).toEqual({
          expr: 'sum by (level, detected_level) (count_over_time({label="value"} | drop __error__[$__auto]))',
          queryType: LokiQueryType.Range,
          refId: 'log-volume-A',
          supportingQueryType: SupportingQueryType.LogsVolume,
        });
      });

      it('returns logs volume query for range log query', () => {
        expect(
          ds.getSupplementaryQuery(
            { type: SupplementaryQueryType.LogsVolume },
            {
              expr: '{label="value"}',
              queryType: LokiQueryType.Range,
              refId: 'A',
            }
          )
        ).toEqual({
          expr: 'sum by (level, detected_level) (count_over_time({label="value"} | drop __error__[$__auto]))',
          queryType: LokiQueryType.Range,
          refId: 'log-volume-A',
          supportingQueryType: SupportingQueryType.LogsVolume,
        });
      });

      it('does not return logs volume query for hidden log query', () => {
        expect(
          ds.getSupplementaryQuery(
            { type: SupplementaryQueryType.LogsVolume },
            {
              expr: '{label="value"}',
              queryType: LokiQueryType.Range,
              refId: 'A',
              hide: true,
            }
          )
        ).toEqual(undefined);
      });

      it('returns logs volume query for instant log query', () => {
        // we changed logic to automatically run logs queries as range queries, thus there's a volume query now
        expect(
          ds.getSupplementaryQuery(
            { type: SupplementaryQueryType.LogsVolume },
            {
              expr: '{label="value"}',
              queryType: LokiQueryType.Instant,
              refId: 'A',
            }
          )
        ).toEqual({
          expr: 'sum by (level, detected_level) (count_over_time({label="value"} | drop __error__[$__auto]))',
          queryType: 'range',
          refId: 'log-volume-A',
          supportingQueryType: 'logsVolume',
        });
      });

      it('does not return logs volume query for metric query', () => {
        expect(
          ds.getSupplementaryQuery(
            { type: SupplementaryQueryType.LogsVolume },
            {
              expr: 'rate({label="value"}[5m]',
              queryType: LokiQueryType.Range,
              refId: 'A',
            }
          )
        ).toEqual(undefined);
      });

      it('return logs volume query with defined field', () => {
        const query = ds.getSupplementaryQuery(
          { type: SupplementaryQueryType.LogsVolume, field: 'test' },
          {
            expr: '{label="value"}',
            queryType: LokiQueryType.Range,
            refId: 'A',
          }
        );
        expect(query?.expr).toEqual('sum by (test) (count_over_time({label="value"} | drop __error__[$__auto]))');
      });

      it('return logs volume query with level as field if no field specified', () => {
        const query = ds.getSupplementaryQuery(
          { type: SupplementaryQueryType.LogsVolume },
          {
            expr: '{label="value"}',
            queryType: LokiQueryType.Range,
            refId: 'A',
          }
        );
        expect(query?.expr).toEqual(
          'sum by (level, detected_level) (count_over_time({label="value"} | drop __error__[$__auto]))'
        );
      });
    });

    describe('logs sample', () => {
      it('returns logs sample query for range metric query', () => {
        expect(
          ds.getSupplementaryQuery(
            { type: SupplementaryQueryType.LogsSample },
            {
              expr: 'rate({label="value"}[5m]',
              queryType: LokiQueryType.Range,
              refId: 'A',
            }
          )
        ).toEqual({
          expr: '{label="value"}',
          queryType: 'range',
          refId: 'log-sample-A',
          maxLines: 20,
          supportingQueryType: SupportingQueryType.LogsSample,
        });
      });

      it('does not return logs sample query for hidden query', () => {
        expect(
          ds.getSupplementaryQuery(
            { type: SupplementaryQueryType.LogsSample },
            {
              expr: 'rate({label="value"}[5m]',
              queryType: LokiQueryType.Range,
              refId: 'A',
              hide: true,
            }
          )
        ).toEqual(undefined);
      });

      it('returns logs sample query for instant metric query', () => {
        expect(
          ds.getSupplementaryQuery(
            { type: SupplementaryQueryType.LogsSample },
            {
              expr: 'rate({label="value"}[5m]',
              queryType: LokiQueryType.Instant,
              refId: 'A',
            }
          )
        ).toEqual({
          expr: '{label="value"}',
          queryType: LokiQueryType.Range,
          refId: 'log-sample-A',
          maxLines: 20,
          supportingQueryType: SupportingQueryType.LogsSample,
        });
      });

      it('correctly overrides maxLines if limit is set', () => {
        expect(
          ds.getSupplementaryQuery(
            { type: SupplementaryQueryType.LogsSample, limit: 5 },
            {
              expr: 'rate({label="value"}[5m]',
              queryType: LokiQueryType.Instant,
              refId: 'A',
            }
          )
        ).toEqual({
          expr: '{label="value"}',
          queryType: LokiQueryType.Range,
          refId: 'log-sample-A',
          supportingQueryType: SupportingQueryType.LogsSample,
          maxLines: 5,
        });
      });

      it('does not return logs sample query for log query query', () => {
        expect(
          ds.getSupplementaryQuery(
            { type: SupplementaryQueryType.LogsSample },
            {
              expr: '{label="value"}',
              queryType: LokiQueryType.Range,
              refId: 'A',
            }
          )
        ).toEqual(undefined);
      });
    });
  });

  describe('importing queries', () => {
    let ds: LokiDatasource;
    beforeEach(() => {
      ds = createLokiDatasource(templateSrvStub);
    });

    it('keeps all labels when no labels are loaded', async () => {
      ds.getResource = <T>() => Promise.resolve({ data: [] } as T);
      const queries = await ds.importFromAbstractQueries([
        {
          refId: 'A',
          labelMatchers: [
            { name: 'foo', operator: AbstractLabelOperator.Equal, value: 'bar' },
            { name: 'foo2', operator: AbstractLabelOperator.Equal, value: 'bar2' },
          ],
        },
      ]);
      expect(queries[0].expr).toBe('{foo="bar", foo2="bar2"}');
    });

    it('filters out non existing labels', async () => {
      ds.getResource = <T>() => Promise.resolve({ data: ['foo'] } as T);
      const queries = await ds.importFromAbstractQueries([
        {
          refId: 'A',
          labelMatchers: [
            { name: 'foo', operator: AbstractLabelOperator.Equal, value: 'bar' },
            { name: 'foo2', operator: AbstractLabelOperator.Equal, value: 'bar2' },
          ],
        },
      ]);
      expect(queries[0].expr).toBe('{foo="bar"}');
    });
  });

  describe('getDataSamples', () => {
    let ds: LokiDatasource;
    beforeEach(() => {
      ds = createLokiDatasource(templateSrvStub);
    });
    it('ignores invalid queries', () => {
      const spy = jest.spyOn(ds, 'query');
      ds.getDataSamples({ expr: 'not a query', refId: 'A' }, mockTimeRange);
      expect(spy).not.toHaveBeenCalled();
    });
    it('ignores metric queries', () => {
      const spy = jest.spyOn(ds, 'query');
      ds.getDataSamples({ expr: 'count_over_time({a="b"}[1m])', refId: 'A' }, mockTimeRange);
      expect(spy).not.toHaveBeenCalled();
    });
    it('uses the current interval in the request', () => {
      const spy = jest.spyOn(ds, 'query').mockImplementation(() => of({} as DataQueryResponse));
      ds.getDataSamples({ expr: '{job="bar"}', refId: 'A' }, mockTimeRange);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          range: mockTimeRange,
        })
      );
    });
    it('hides the request from the inspector', () => {
      const spy = jest.spyOn(ds, 'query').mockImplementation(() => of({} as DataQueryResponse));
      ds.getDataSamples({ expr: '{job="bar"}', refId: 'A' }, mockTimeRange);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          hideFromInspector: true,
          requestId: REF_ID_DATA_SAMPLES,
        })
      );
    });
    it('sets the supporting query type in the request', () => {
      const spy = jest.spyOn(ds, 'query').mockImplementation(() => of({} as DataQueryResponse));
      ds.getDataSamples({ expr: '{job="bar"}', refId: 'A' }, mockTimeRange);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: [expect.objectContaining({ supportingQueryType: SupportingQueryType.DataSample })],
        })
      );
    });
  });

  describe('Query splitting', () => {
    beforeAll(() => {
      config.featureToggles.lokiQuerySplitting = true;
      jest.mocked(runSplitQuery).mockReturnValue(
        of({
          data: [],
        })
      );
    });
    afterAll(() => {
      config.featureToggles.lokiQuerySplitting = false;
    });
    it.each([
      [[{ expr: 'count_over_time({a="b"}[1m])', refId: 'A' }]],
      [[{ expr: '{a="b"}', refId: 'A' }]],
      [
        [
          { expr: 'count_over_time({a="b"}[1m])', refId: 'A', hide: true },
          { expr: '{a="b"}', refId: 'B' },
        ],
      ],
    ])('supports query splitting when the requirements are met', async (targets: LokiQuery[]) => {
      const ds = createLokiDatasource(templateSrvStub);
      const query: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets,
        app: CoreApp.Dashboard,
      };

      await expect(ds.query(query)).toEmitValuesWith(() => {
        expect(runSplitQuery).toHaveBeenCalled();
      });
    });
  });

  describe('scopes application', () => {
    let ds: LokiDatasource;
    let origBackendSrv: BackendSrv;

    beforeEach(() => {
      origBackendSrv = getBackendSrv();
      ds = createLokiDatasource(templateSrvStub);
      // Enable the required feature toggles
      config.featureToggles.scopeFilters = true;
      config.featureToggles.logQLScope = true;
    });

    afterEach(() => {
      setBackendSrv(origBackendSrv);
      // Reset feature toggles to false
      config.featureToggles.scopeFilters = false;
      config.featureToggles.logQLScope = false;
    });

    it('should apply scopes to queries when feature toggles are enabled', async () => {
      const mockScopes = [
        {
          metadata: { name: 'test-scope' },
          spec: {
            title: 'Test Scope',
            type: 'test',
            description: 'Test scope description',
            category: 'test-category',
            filters: [
              { key: 'environment', value: 'production', operator: 'equals' as const },
              { key: 'service', value: 'api', operator: 'equals' as const },
            ],
          },
        },
      ];

      const query: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [{ expr: '{job="grafana"}', refId: 'A' }],
        scopes: mockScopes,
      };

      const fetchMock = jest.fn().mockReturnValue(of({ data: testLogsResponse }));
      setBackendSrv({ ...origBackendSrv, fetch: fetchMock });

      await ds.query(query).pipe(take(1)).toPromise();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queries: expect.arrayContaining([
              expect.objectContaining({
                scopes: [
                  { key: 'environment', value: 'production', operator: 'equals' },
                  { key: 'service', value: 'api', operator: 'equals' },
                ],
              }),
            ]),
          }),
        })
      );
    });

    it('should not apply scopes when feature toggles are disabled', async () => {
      // Disable the required feature toggles
      config.featureToggles.scopeFilters = false;
      config.featureToggles.logQLScope = false;

      const mockScopes = [
        {
          metadata: { name: 'test-scope' },
          spec: {
            title: 'Test Scope',
            type: 'test',
            description: 'Test scope description',
            category: 'test-category',
            filters: [{ key: 'environment', value: 'production', operator: 'equals' as const }],
          },
        },
      ];

      const query: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [{ expr: '{job="grafana"}', refId: 'A' }],
        scopes: mockScopes,
      };

      const fetchMock = jest.fn().mockReturnValue(of({ data: testLogsResponse }));
      setBackendSrv({ ...origBackendSrv, fetch: fetchMock });

      await ds.query(query).pipe(take(1)).toPromise();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queries: expect.arrayContaining([
              expect.objectContaining({
                scopes: undefined,
              }),
            ]),
          }),
        })
      );
    });

    it('should handle empty scopes array', async () => {
      const query: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [{ expr: '{job="grafana"}', refId: 'A' }],
        scopes: [],
      };

      const fetchMock = jest.fn().mockReturnValue(of({ data: testLogsResponse }));
      setBackendSrv({ ...origBackendSrv, fetch: fetchMock });

      await ds.query(query).pipe(take(1)).toPromise();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queries: expect.arrayContaining([
              expect.objectContaining({
                scopes: [],
              }),
            ]),
          }),
        })
      );
    });

    it('should handle undefined scopes', async () => {
      const query: DataQueryRequest<LokiQuery> = {
        ...baseRequestOptions,
        targets: [{ expr: '{job="grafana"}', refId: 'A' }],
        scopes: undefined,
      };

      const fetchMock = jest.fn().mockReturnValue(of({ data: testLogsResponse }));
      setBackendSrv({ ...origBackendSrv, fetch: fetchMock });

      await ds.query(query).pipe(take(1)).toPromise();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            queries: expect.arrayContaining([
              expect.objectContaining({
                scopes: undefined,
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('getQueryStats', () => {
    let ds: LokiDatasource;
    let query: LokiQuery;
    beforeEach(() => {
      ds = createLokiDatasource(templateSrvStub);
      ds.statsMetadataRequest = jest.fn().mockResolvedValue({ streams: 1, chunks: 1, bytes: 1, entries: 1 });
      ds.interpolateString = jest.fn().mockImplementation((value: string) => value.replace('$__auto', '1m'));

      query = { refId: 'A', expr: '', queryType: LokiQueryType.Range };
    });

    it('uses statsMetadataRequest', async () => {
      query.expr = '{foo="bar"}';
      const result = await ds.getQueryStats(query, mockTimeRange);

      expect(ds.statsMetadataRequest).toHaveBeenCalled();
      expect(result).toEqual({ streams: 1, chunks: 1, bytes: 1, entries: 1 });
    });

    it('supports queries with template variables', async () => {
      query.expr = 'rate({instance="server\\1"}[$__auto])';
      const result = await ds.getQueryStats(query, mockTimeRange);

      expect(result).toEqual({
        streams: 1,
        chunks: 1,
        bytes: 1,
        entries: 1,
      });
    });

    it('does not call stats if the query is invalid', async () => {
      query.expr = 'rate({label="value"}';
      const result = await ds.getQueryStats(query, mockTimeRange);

      expect(ds.statsMetadataRequest).not.toHaveBeenCalled();
      expect(result).toBe(undefined);
    });

    it('combines the stats of each label matcher', async () => {
      query.expr = 'count_over_time({foo="bar"}[1m]) + count_over_time({test="test"}[1m])';
      const result = await ds.getQueryStats(query, mockTimeRange);

      expect(ds.statsMetadataRequest).toHaveBeenCalled();
      expect(result).toEqual({ streams: 2, chunks: 2, bytes: 2, entries: 2 });
    });

    it('calls statsMetadataRequest with the right properties', async () => {
      query.expr = 'count_over_time({foo="bar"}[1m])';
      await ds.getQueryStats(query, mockTimeRange);

      expect(ds.statsMetadataRequest).toHaveBeenCalledWith(
        `index/stats`,
        {
          start: 0,
          end: 1000000,
          query: '{foo="bar"}',
        },
        { requestId: 'log-stats-A', showErrorAlert: false }
      );
    });
  });

  describe('statsMetadataRequest', () => {
    it('throws error if url starts with /', () => {
      const ds = createLokiDatasource();
      expect(async () => {
        await ds.statsMetadataRequest('/index');
      }).rejects.toThrow('invalid metadata request url: /index');
    });
  });

  describe('live tailing', () => {
    it('interpolates variables with scopedVars and filters', () => {
      const ds = createLokiDatasource();
      const query: LokiQuery = { expr: '{app=$app}', refId: 'A' };
      const scopedVars: ScopedVars = { app: { text: 'interpolated', value: 'interpolated' } };
      const filters: AdHocFilter[] = [];

      jest.spyOn(ds, 'applyTemplateVariables').mockImplementation((query) => query);
      ds.query({ targets: [query], scopedVars, filters, liveStreaming: true } as DataQueryRequest<LokiQuery>);
      expect(ds.applyTemplateVariables).toHaveBeenCalledWith(expect.objectContaining(query), scopedVars, filters);
    });
  });

  describe('getTagKeys', () => {
    it('should pass timeRange and filters to the request', async () => {
      const ds = createLokiDatasource();
      const filters = [
        { key: 'foo', operator: '=', value: 'bar' },
        { key: 'foo2', operator: '=', value: 'bar2' },
      ];
      const spy = jest.spyOn(ds.languageProvider, 'fetchLabels').mockResolvedValue([]);

      await ds.getTagKeys({ filters, timeRange: mockTimeRange });
      expect(spy).toHaveBeenCalledWith({ streamSelector: '{foo="bar", foo2="bar2"}', timeRange: mockTimeRange });
    });

    it('should pass regex filters', async () => {
      const ds = createLokiDatasource();
      const filters = [
        { key: 'foo', operator: '=~', value: 'abc|def' },
        { key: 'foo2', operator: '=', value: 'bar2' },
      ];
      const spy = jest.spyOn(ds.languageProvider, 'fetchLabels').mockResolvedValue([]);

      await ds.getTagKeys({ filters, timeRange: mockTimeRange });
      expect(spy).toHaveBeenCalledWith({ streamSelector: '{foo=~"abc|def", foo2="bar2"}', timeRange: mockTimeRange });
    });

    it('should pass empty stream selector when no filters', async () => {
      const ds = createLokiDatasource();
      const filters: AdHocVariableFilter[] = [];
      const spy = jest.spyOn(ds.languageProvider, 'fetchLabels').mockResolvedValue([]);

      await ds.getTagKeys({ filters, timeRange: mockTimeRange });
      expect(spy).toHaveBeenCalledWith({ streamSelector: '{}', timeRange: mockTimeRange });
    });
  });

  describe('getTagValues', () => {
    it('should pass timeRange and filters to the request', async () => {
      const ds = createLokiDatasource();
      const filters = [
        { key: 'foo', operator: '=', value: 'bar' },
        { key: 'foo2', operator: '=', value: 'bar2' },
      ];
      const spy = jest.spyOn(ds.languageProvider, 'fetchLabelValues').mockResolvedValue([]);

      await ds.getTagValues({ key: 'label1', filters, timeRange: mockTimeRange });
      expect(spy).toHaveBeenCalledWith('label1', {
        streamSelector: '{foo="bar", foo2="bar2"}',
        timeRange: mockTimeRange,
      });
    });

    it('should pass empty stream selector when no filters', async () => {
      const ds = createLokiDatasource();
      const filters: AdHocVariableFilter[] = [];
      const spy = jest.spyOn(ds.languageProvider, 'fetchLabelValues').mockResolvedValue([]);

      await ds.getTagValues({ key: 'label1', filters, timeRange: mockTimeRange });
      expect(spy).toHaveBeenCalledWith('label1', { streamSelector: '{}', timeRange: mockTimeRange });
    });
  });
});

describe('applyTemplateVariables', () => {
  it('should add the adhoc filter to the query', () => {
    const ds = createLokiDatasource();
    const spy = jest.spyOn(ds, 'addAdHocFilters');
    ds.applyTemplateVariables({ expr: '{test}', refId: 'A' }, {}, []);
    expect(spy).toHaveBeenCalledWith('{test}', []);
  });

  describe('with template and built-in variables', () => {
    const scopedVars = {
      __interval: { text: '1m', value: '1m' },
      __interval_ms: { text: '1000', value: '1000' },
      __range: { text: '1m', value: '1m' },
      __range_ms: { text: '1000', value: '1000' },
      __range_s: { text: '60', value: '60' },
      testVariable: { text: 'foo', value: 'foo' },
    };

    it('should not interpolate __interval variables', () => {
      const templateSrvMock = {
        getAdhocFilters: jest.fn().mockImplementation((query: string) => query),
        replace: jest.fn((a: string, ...rest: unknown[]) => a),
      } as unknown as TemplateSrv;

      const ds = createLokiDatasource(templateSrvMock);
      ds.addAdHocFilters = jest.fn().mockImplementation((query: string) => query);
      ds.applyTemplateVariables(
        { expr: 'rate({job="grafana"}[$__interval]) + rate({job="grafana"}[$__interval_ms])', refId: 'A' },
        scopedVars
      );
      expect(templateSrvMock.replace).toHaveBeenCalledTimes(3);
      // Interpolated legend
      expect(templateSrvMock.replace).toHaveBeenCalledWith(
        undefined,
        expect.not.objectContaining({
          __interval: { text: '1m', value: '1m' },
          __interval_ms: { text: '1000', value: '1000' },
        })
      );
      // Interpolated expr
      expect(templateSrvMock.replace).toHaveBeenCalledWith(
        'rate({job="grafana"}[$__interval]) + rate({job="grafana"}[$__interval_ms])',
        expect.not.objectContaining({
          __interval: { text: '1m', value: '1m' },
          __interval_ms: { text: '1000', value: '1000' },
        }),
        expect.any(Function)
      );
    });

    it('should not interpolate __range variables', () => {
      const templateSrvMock = {
        getAdhocFilters: jest.fn().mockImplementation((query: string) => query),
        replace: jest.fn((a: string, ...rest: unknown[]) => a),
      } as unknown as TemplateSrv;

      const ds = createLokiDatasource(templateSrvMock);
      ds.addAdHocFilters = jest.fn().mockImplementation((query: string) => query);
      ds.applyTemplateVariables(
        {
          expr: 'rate({job="grafana"}[$__range]) + rate({job="grafana"}[$__range_ms]) + rate({job="grafana"}[$__range_s])',
          refId: 'A',
        },
        scopedVars
      );
      expect(templateSrvMock.replace).toHaveBeenCalledTimes(3);
      // Interpolated legend
      expect(templateSrvMock.replace).toHaveBeenCalledWith(
        undefined,
        expect.not.objectContaining({
          __range: { text: '1m', value: '1m' },
          __range_ms: { text: '1000', value: '1000' },
          __range_s: { text: '60', value: '60' },
        })
      );
      // Interpolated expr
      expect(templateSrvMock.replace).toHaveBeenCalledWith(
        'rate({job="grafana"}[$__range]) + rate({job="grafana"}[$__range_ms]) + rate({job="grafana"}[$__range_s])',
        expect.not.objectContaining({
          __range: { text: '1m', value: '1m' },
          __range_ms: { text: '1000', value: '1000' },
          __range_s: { text: '60', value: '60' },
        }),
        expect.any(Function)
      );
    });

    it('should replace step', () => {
      const templateSrvMock = {
        getAdhocFilters: jest.fn().mockImplementation((query: string) => query),
        replace: jest.fn((a: string | undefined, ...rest: unknown[]) => a?.replace('$testVariable', 'foo')),
      } as unknown as TemplateSrv;

      const ds = createLokiDatasource(templateSrvMock);
      ds.addAdHocFilters = jest.fn().mockImplementation((query: string) => query);
      const replacedQuery = ds.applyTemplateVariables(
        {
          expr: 'rate({job="grafana"}[$__range]) + rate({job="grafana"}[$__range_ms]) + rate({job="grafana"}[$__range_s])',
          refId: 'A',
          step: '$testVariable',
        },
        scopedVars
      );
      expect(replacedQuery).toEqual(
        expect.objectContaining({
          step: 'foo',
        })
      );
    });

    it('should replace legendFormat', () => {
      const templateSrvMock = {
        getAdhocFilters: jest.fn().mockImplementation((query: string) => query),
        replace: jest.fn((a: string | undefined, ...rest: unknown[]) => a?.replace('$testVariable', 'foo')),
      } as unknown as TemplateSrv;

      const ds = createLokiDatasource(templateSrvMock);
      ds.addAdHocFilters = jest.fn().mockImplementation((query: string) => query);
      const replacedQuery = ds.applyTemplateVariables(
        {
          expr: 'rate({job="grafana"}[$__range]) + rate({job="grafana"}[$__range_ms]) + rate({job="grafana"}[$__range_s])',
          refId: 'A',
          legendFormat: '$testVariable',
        },
        scopedVars
      );
      expect(replacedQuery).toEqual(
        expect.objectContaining({
          legendFormat: 'foo',
        })
      );
    });
  });

  describe('getStatsTimeRange', () => {
    let query: LokiQuery;
    let datasource: LokiDatasource;
    const timeRange = {
      from: 167255280000000, // 01 Jan 2023 06:00:00 GMT
      to: 167263920000000, //   02 Jan 2023 06:00:00 GMT
    } as unknown as TimeRange;

    beforeEach(() => {
      query = { refId: 'A', expr: '', queryType: LokiQueryType.Range };
      datasource = createLokiDatasource();

      datasource.getTimeRangeParams = jest.fn().mockReturnValue({
        start: 1672552800000000000, // 01 Jan 2023 06:00:00 GMT
        end: 1672639200000000000, //   02 Jan 2023 06:00:00 GMT
      });
    });

    it('should return the ds picker timerange for a logs query with range type', () => {
      // log queries with range type should request the ds picker timerange
      // in this case (1 day)
      query.expr = '{job="grafana"}';

      expect(datasource.getStatsTimeRange(query, 0, timeRange)).toEqual({
        start: 1672552800000000000, // 01 Jan 2023 06:00:00 GMT
        end: 1672639200000000000, //   02 Jan 2023 06:00:00 GMT
      });
    });

    it('should return nothing for a logs query with instant type', () => {
      // log queries with instant type should be invalid.
      query.queryType = LokiQueryType.Instant;
      query.expr = '{job="grafana"}';

      expect(datasource.getStatsTimeRange(query, 0, timeRange)).toEqual({
        start: undefined,
        end: undefined,
      });
    });

    it('should return the ds picker time range', () => {
      // metric queries with range type should request ds picker timerange
      // in this case (1 day)
      query.expr = 'rate({job="grafana"}[5m])';

      expect(datasource.getStatsTimeRange(query, 0, timeRange)).toEqual({
        start: 1672552800000000000, // 01 Jan 2023 06:00:00 GMT
        end: 1672639200000000000, //   02 Jan 2023 06:00:00 GMT
      });
    });

    it('should return the range duration for an instant metric query', () => {
      // metric queries with instant type should request range duration
      // in this case (5 minutes)
      query.queryType = LokiQueryType.Instant;
      query.expr = 'rate({job="grafana"}[5m])';

      expect(datasource.getStatsTimeRange(query, 0, timeRange)).toEqual({
        start: 1672638900000000000, // 02 Jan 2023 05:55:00 GMT
        end: 1672639200000000000, //   02 Jan 2023 06:00:00 GMT
      });
    });
  });
});

describe('makeStatsRequest', () => {
  const datasource = createLokiDatasource();
  let query: LokiQuery;

  beforeEach(() => {
    query = { refId: 'A', expr: '', queryType: LokiQueryType.Range };
  });

  it('should return null if there is no query', () => {
    query.expr = '';
    expect(datasource.getStats(query, mockTimeRange)).resolves.toBe(null);
  });

  it('should return null if the query is invalid', () => {
    query.expr = '{job="grafana",';
    expect(datasource.getStats(query, mockTimeRange)).resolves.toBe(null);
  });

  it('should return null if the response has no data', () => {
    query.expr = '{job="grafana"}';
    datasource.getQueryStats = jest.fn().mockResolvedValue({ streams: 0, chunks: 0, bytes: 0, entries: 0 });
    expect(datasource.getStats(query, mockTimeRange)).resolves.toBe(null);
  });

  it('should return the stats if the response has data', () => {
    query.expr = '{job="grafana"}';

    datasource.getQueryStats = jest
      .fn()
      .mockResolvedValue({ streams: 1, chunks: 12611, bytes: 12913664, entries: 78344 });
    expect(datasource.getStats(query, mockTimeRange)).resolves.toEqual({
      streams: 1,
      chunks: 12611,
      bytes: 12913664,
      entries: 78344,
    });
  });

  it('should support queries with variables', () => {
    query.expr = 'count_over_time({job="grafana"}[$__interval])';

    datasource.interpolateString = jest
      .fn()
      .mockImplementationOnce((value: string) => value.replace('$__interval', '1h'));
    datasource.getQueryStats = jest
      .fn()
      .mockResolvedValue({ streams: 1, chunks: 12611, bytes: 12913664, entries: 78344 });
    expect(datasource.getStats(query, mockTimeRange)).resolves.toEqual({
      streams: 1,
      chunks: 12611,
      bytes: 12913664,
      entries: 78344,
    });
  });
});

describe('getTimeRangeParams()', () => {
  it('turns time range into a Loki range parameters', () => {
    const ds = createLokiDatasource();
    const range = {
      from: dateTime(1524650400000),
      to: dateTime(1524654000000),
      raw: {
        from: 'now-1h',
        to: 'now',
      },
    };
    const params = ds.getTimeRangeParams(range);

    // Returns a very big integer, so we stringify it for the assertion
    expect(JSON.stringify(params)).toEqual('{"start":1524650400000000000,"end":1524654000000000000}');
  });
});

describe('Variable support', () => {
  it('has Loki variable support', () => {
    const ds = createLokiDatasource(templateSrvStub);

    expect(ds.variables).toBeInstanceOf(LokiVariableSupport);
  });
});

describe('queryHasFilter()', () => {
  let ds: LokiDatasource;
  beforeEach(() => {
    ds = createLokiDatasource(templateSrvStub);
  });
  it('inspects queries for filter presence', () => {
    const query = { refId: 'A', expr: '{grafana="awesome"}' };
    expect(
      ds.queryHasFilter(query, {
        key: 'grafana',
        value: 'awesome',
      })
    ).toBe(true);
  });
});

function assertAdHocFilters(query: string, expectedResults: string, ds: LokiDatasource, adhocFilters?: AdHocFilter[]) {
  const lokiQuery: LokiQuery = { refId: 'A', expr: query };
  const result = ds.addAdHocFilters(lokiQuery.expr, adhocFilters);

  expect(result).toEqual(expectedResults);
}

function makeAnnotationQueryRequest(options = {}): AnnotationQueryRequest<LokiQuery> {
  const timeRange = {
    from: dateTime(),
    to: dateTime(),
  };
  return {
    annotation: {
      expr: '{test=test}',
      refId: '',
      datasource: {
        type: 'loki',
      },
      enable: true,
      name: 'test-annotation',
      iconColor: 'red',
      ...options,
    },
    dashboard: {
      id: 1,
    },
    range: {
      ...timeRange,
      raw: timeRange,
    },
    rangeRaw: timeRange,
  };
}
