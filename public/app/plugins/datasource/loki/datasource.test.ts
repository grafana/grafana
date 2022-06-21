import { of } from 'rxjs';
import { take } from 'rxjs/operators';
import { getQueryOptions } from 'test/helpers/getQueryOptions';

import {
  AbstractLabelOperator,
  AnnotationQueryRequest,
  ArrayVector,
  DataFrame,
  dataFrameToJSON,
  DataQueryResponse,
  dateTime,
  FieldType,
  LogRowModel,
  MutableDataFrame,
  toUtc,
} from '@grafana/data';
import { BackendSrvRequest, FetchResponse, setBackendSrv, getBackendSrv, BackendSrv } from '@grafana/runtime';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { initialCustomVariableModelState } from '../../../features/variables/custom/reducer';
import { CustomVariableModel } from '../../../features/variables/types';

import { isMetricsQuery, LokiDatasource } from './datasource';
import { makeMockLokiDatasource } from './mocks';
import { LokiQuery, LokiQueryType } from './types';

const rawRange = {
  from: toUtc('2018-04-25 10:00'),
  to: toUtc('2018-04-25 11:00'),
};

const timeSrvStub = {
  timeRange: () => ({
    from: rawRange.from,
    to: rawRange.to,
    raw: rawRange,
  }),
} as unknown as TimeSrv;

const templateSrvStub = {
  getAdhocFilters: jest.fn(() => [] as any[]),
  replace: jest.fn((a: string, ...rest: any) => a),
};

const testFrame: DataFrame = {
  refId: 'A',
  fields: [
    {
      name: 'Time',
      type: FieldType.time,
      config: {},
      values: new ArrayVector([1, 2]),
    },
    {
      name: 'Line',
      type: FieldType.string,
      config: {},
      values: new ArrayVector(['line1', 'line2']),
    },
    {
      name: 'labels',
      type: FieldType.other,
      config: {},
      values: new ArrayVector([
        {
          label: 'value',
          label2: 'value ',
        },
        {
          label: '',
          label2: 'value2',
          label3: ' ',
        },
      ]),
    },
    {
      name: 'tsNs',
      type: FieldType.string,
      config: {},
      values: new ArrayVector(['1000000', '2000000']),
    },
    {
      name: 'id',
      type: FieldType.string,
      config: {},
      values: new ArrayVector(['id1', 'id2']),
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
  headers: {} as unknown as Headers,
  redirected: false,
  status: 200,
  statusText: 'Success',
  type: 'default',
  url: '',
  config: {} as unknown as BackendSrvRequest,
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
  });

  describe('when doing logs queries with limits', () => {
    const runTest = async (
      queryMaxLines: number | undefined,
      dsMaxLines: number | undefined,
      expectedMaxLines: number
    ) => {
      let settings: any = {
        url: 'myloggingurl',
        jsonData: {
          maxLines: dsMaxLines,
        },
      };

      const templateSrvMock = {
        getAdhocFilters: (): any[] => [],
        replace: (a: string) => a,
      } as unknown as TemplateSrv;

      const ds = new LokiDatasource(settings, templateSrvMock, timeSrvStub as any);

      // we need to check the final query before it is sent out,
      // and applyTemplateVariables is a convenient place to do that.
      const spy = jest.spyOn(ds, 'applyTemplateVariables');

      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{a="b"}', refId: 'B', maxLines: queryMaxLines }],
      });

      const fetchMock = jest.fn().mockReturnValue(of({ data: testLogsResponse }));
      setBackendSrv({ ...origBackendSrv, fetch: fetchMock });

      await expect(ds.query(options).pipe(take(1))).toEmitValuesWith(() => {
        expect(fetchMock.mock.calls.length).toBe(1);
        expect(spy.mock.calls[0][0].maxLines).toBe(expectedMaxLines);
      });
    };

    it('should use datasource max lines when no query max lines', async () => {
      await runTest(undefined, 40, 40);
    });

    it('should use query max lines, if exists', async () => {
      await runTest(80, undefined, 80);
    });

    it('should use query max lines, if both exist, even if it is higher than ds max lines', async () => {
      await runTest(80, 40, 80);
    });
  });

  describe('When using adhoc filters', () => {
    const DEFAULT_EXPR = 'rate({bar="baz", job="foo"} |= "bar" [5m])';
    const query: LokiQuery = { expr: DEFAULT_EXPR, refId: 'A' };
    const originalAdhocFiltersMock = templateSrvStub.getAdhocFilters();
    const ds = new LokiDatasource({} as any, templateSrvStub as any, timeSrvStub as any);

    afterAll(() => {
      templateSrvStub.getAdhocFilters.mockReturnValue(originalAdhocFiltersMock);
    });

    it('should not modify expression with no filters', async () => {
      expect(ds.applyTemplateVariables(query, {}).expr).toBe(DEFAULT_EXPR);
    });

    it('should add filters to expression', async () => {
      templateSrvStub.getAdhocFilters.mockReturnValue([
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
      ]);

      expect(ds.applyTemplateVariables(query, {}).expr).toBe(
        'rate({bar="baz",job="foo",k1="v1",k2!="v2"} |= "bar" [5m])'
      );
    });

    it('should add escaping if needed to regex filter expressions', async () => {
      templateSrvStub.getAdhocFilters.mockReturnValue([
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
      ]);
      expect(ds.applyTemplateVariables(query, {}).expr).toBe(
        'rate({bar="baz",job="foo",k1=~"v\\\\.\\\\*",k2=~"v\'\\\\.\\\\*"} |= "bar" [5m])'
      );
    });
  });

  describe('when interpolating variables', () => {
    let ds: LokiDatasource;
    let variable: CustomVariableModel;

    beforeEach(() => {
      ds = createLokiDSForTests();
      variable = { ...initialCustomVariableModelState };
    });

    it('should only escape single quotes', () => {
      expect(ds.interpolateQueryExpr("abc'$^*{}[]+?.()|", variable)).toEqual("abc\\\\'$^*{}[]+?.()|");
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

  describe('when performing testDataSource', () => {
    it('should return successfully when call succeeds with labels', async () => {
      const ds = createLokiDSForTests({} as TemplateSrv);
      ds.metadataRequest = () => Promise.resolve(['avalue']);

      const result = await ds.testDatasource();

      expect(result).toStrictEqual({
        status: 'success',
        message: 'Data source connected and labels found.',
      });
    });

    it('should return error when call succeeds without labels', async () => {
      const ds = createLokiDSForTests({} as TemplateSrv);
      ds.metadataRequest = () => Promise.resolve([]);

      const result = await ds.testDatasource();

      expect(result).toStrictEqual({
        status: 'error',
        message: 'Data source connected, but no labels received. Verify that Loki and Promtail is configured properly.',
      });
    });

    it('should return error status with no details when call fails with no details', async () => {
      const ds = createLokiDSForTests({} as TemplateSrv);
      ds.metadataRequest = () => Promise.reject({});

      const result = await ds.testDatasource();

      expect(result).toStrictEqual({
        status: 'error',
        message: 'Unable to fetch labels from Loki, please check the server logs for more details',
      });
    });

    it('should return error status with details when call fails with details', async () => {
      const ds = createLokiDSForTests({} as TemplateSrv);
      ds.metadataRequest = () =>
        Promise.reject({
          data: {
            message: 'error42',
          },
        });

      const result = await ds.testDatasource();

      expect(result).toStrictEqual({
        status: 'error',
        message: 'Unable to fetch labels from Loki (error42), please check the server logs for more details',
      });
    });
  });

  describe('when calling annotationQuery', () => {
    const getTestContext = (frame: DataFrame, options: any = []) => {
      const query = makeAnnotationQueryRequest(options);

      const ds = createLokiDSForTests();
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
            values: new ArrayVector([1, 2]),
          },
          {
            name: 'Line',
            type: FieldType.string,
            config: {},
            values: new ArrayVector(['hello', 'hello 2']),
          },
          {
            name: 'labels',
            type: FieldType.other,
            config: {},
            values: new ArrayVector([
              {
                label: 'value',
                label2: 'value ',
              },
              {
                label: '',
                label2: 'value2',
                label3: ' ',
              },
            ]),
          },
          {
            name: 'tsNs',
            type: FieldType.string,
            config: {},
            values: new ArrayVector(['1000000', '2000000']),
          },
          {
            name: 'id',
            type: FieldType.string,
            config: {},
            values: new ArrayVector(['id1', 'id2']),
          },
        ],
        length: 2,
      };
      const res = await getTestContext(testFrame, { stepInterval: '15s' });

      expect(res.length).toBe(2);
      expect(res[0].text).toBe('hello');
      expect(res[0].tags).toEqual(['value']);

      expect(res[1].text).toBe('hello 2');
      expect(res[1].tags).toEqual(['value2']);
    });

    describe('Formatting', () => {
      const testFrame: DataFrame = {
        refId: 'A',
        fields: [
          {
            name: 'Time',
            type: FieldType.time,
            config: {},
            values: new ArrayVector([1]),
          },
          {
            name: 'Line',
            type: FieldType.string,
            config: {},
            values: new ArrayVector(['hello']),
          },
          {
            name: 'labels',
            type: FieldType.other,
            config: {},
            values: new ArrayVector([
              {
                label: 'value',
                label2: 'value2',
                label3: 'value3',
              },
            ]),
          },
          {
            name: 'tsNs',
            type: FieldType.string,
            config: {},
            values: new ArrayVector(['1000000']),
          },
          {
            name: 'id',
            type: FieldType.string,
            config: {},
            values: new ArrayVector(['id1']),
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
        it('should fromat the text accordingly', async () => {
          const res = await getTestContext(testFrame, { textFormat: 'hello {{label2}}', stepInterval: '15s' });

          expect(res.length).toBe(1);
          expect(res[0].text).toBe('hello value2');
        });
      });
      describe('When titleFormat is set', () => {
        it('should fromat the title accordingly', async () => {
          const res = await getTestContext(testFrame, { titleFormat: 'Title {{label2}}', stepInterval: '15s' });

          expect(res.length).toBe(1);
          expect(res[0].title).toBe('Title value2');
          expect(res[0].text).toBe('hello');
        });
      });
    });
  });

  describe('metricFindQuery', () => {
    const getTestContext = (mock: LokiDatasource) => {
      const ds = createLokiDSForTests();
      ds.metadataRequest = mock.metadataRequest;

      return { ds };
    };

    const mock = makeMockLokiDatasource(
      { label1: ['value1', 'value2'], label2: ['value3', 'value4'] },
      { '{label1="value1", label2="value2"}': [{ label5: 'value5' }] }
    );

    it(`should return label names for Loki`, async () => {
      const { ds } = getTestContext(mock);

      const res = await ds.metricFindQuery('label_names()');

      expect(res).toEqual([{ text: 'label1' }, { text: 'label2' }]);
    });

    it(`should return label values for Loki when no matcher`, async () => {
      const { ds } = getTestContext(mock);

      const res = await ds.metricFindQuery('label_values(label1)');

      expect(res).toEqual([{ text: 'value1' }, { text: 'value2' }]);
    });

    it(`should return label values for Loki with matcher`, async () => {
      const { ds } = getTestContext(mock);

      const res = await ds.metricFindQuery('label_values({label1="value1", label2="value2"},label5)');

      expect(res).toEqual([{ text: 'value5' }]);
    });

    it(`should return empty array when incorrect query for Loki`, async () => {
      const { ds } = getTestContext(mock);

      const res = await ds.metricFindQuery('incorrect_query');

      expect(res).toEqual([]);
    });
  });

  describe('modifyQuery', () => {
    describe('when called with ADD_FILTER', () => {
      describe('and query has no parser', () => {
        it('then the correct label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
          const action = { key: 'job', value: 'grafana', type: 'ADD_FILTER' };
          const ds = createLokiDSForTests();
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz",job="grafana"}');
        });

        it('then the correctly escaped label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
          const action = { key: 'job', value: '\\test', type: 'ADD_FILTER' };
          const ds = createLokiDSForTests();
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz",job="\\\\test"}');
        });

        it('then the correct label should be added for metrics query', () => {
          const query: LokiQuery = { refId: 'A', expr: 'rate({bar="baz"}[5m])' };
          const action = { key: 'job', value: 'grafana', type: 'ADD_FILTER' };
          const ds = createLokiDSForTests();
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('rate({bar="baz",job="grafana"}[5m])');
        });
        describe('and query has parser', () => {
          it('then the correct label should be added for logs query', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | logfmt' };
            const action = { key: 'job', value: 'grafana', type: 'ADD_FILTER' };
            const ds = createLokiDSForTests();
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz"} | logfmt | job="grafana"');
          });
          it('then the correct label should be added for metrics query', () => {
            const query: LokiQuery = { refId: 'A', expr: 'rate({bar="baz"} | logfmt [5m])' };
            const action = { key: 'job', value: 'grafana', type: 'ADD_FILTER' };
            const ds = createLokiDSForTests();
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('rate({bar="baz",job="grafana"} | logfmt [5m])');
          });
        });
      });
    });

    describe('when called with ADD_FILTER_OUT', () => {
      describe('and query has no parser', () => {
        it('then the correct label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
          const action = { key: 'job', value: 'grafana', type: 'ADD_FILTER_OUT' };
          const ds = createLokiDSForTests();
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz",job!="grafana"}');
        });

        it('then the correctly escaped label should be added for logs query', () => {
          const query: LokiQuery = { refId: 'A', expr: '{bar="baz"}' };
          const action = { key: 'job', value: '"test', type: 'ADD_FILTER_OUT' };
          const ds = createLokiDSForTests();
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('{bar="baz",job!="\\"test"}');
        });

        it('then the correct label should be added for metrics query', () => {
          const query: LokiQuery = { refId: 'A', expr: 'rate({bar="baz"}[5m])' };
          const action = { key: 'job', value: 'grafana', type: 'ADD_FILTER_OUT' };
          const ds = createLokiDSForTests();
          const result = ds.modifyQuery(query, action);

          expect(result.refId).toEqual('A');
          expect(result.expr).toEqual('rate({bar="baz",job!="grafana"}[5m])');
        });
        describe('and query has parser', () => {
          it('then the correct label should be added for logs query', () => {
            const query: LokiQuery = { refId: 'A', expr: '{bar="baz"} | logfmt' };
            const action = { key: 'job', value: 'grafana', type: 'ADD_FILTER_OUT' };
            const ds = createLokiDSForTests();
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('{bar="baz"} | logfmt | job!="grafana"');
          });
          it('then the correct label should be added for metrics query', () => {
            const query: LokiQuery = { refId: 'A', expr: 'rate({bar="baz"} | logfmt [5m])' };
            const action = { key: 'job', value: 'grafana', type: 'ADD_FILTER_OUT' };
            const ds = createLokiDSForTests();
            const result = ds.modifyQuery(query, action);

            expect(result.refId).toEqual('A');
            expect(result.expr).toEqual('rate({bar="baz",job!="grafana"} | logfmt [5m])');
          });
        });
      });
    });
  });

  describe('addAdHocFilters', () => {
    let ds: LokiDatasource;
    let adHocFilters: AdHocFilter[];
    describe('when called with "=" operator', () => {
      beforeEach(() => {
        adHocFilters = [
          {
            condition: '',
            key: 'job',
            operator: '=',
            value: 'grafana',
          },
        ];
        const templateSrvMock = {
          getAdhocFilters: (): AdHocFilter[] => adHocFilters,
          replace: (a: string) => a,
        } as unknown as TemplateSrv;
        ds = createLokiDSForTests(templateSrvMock);
      });
      describe('and query has no parser', () => {
        it('then the correct label should be added for logs query', () => {
          assertAdHocFilters('{bar="baz"}', '{bar="baz",job="grafana"}', ds);
        });

        it('then the correct label should be added for metrics query', () => {
          assertAdHocFilters('rate({bar="baz"}[5m])', 'rate({bar="baz",job="grafana"}[5m])', ds);
        });
      });
      describe('and query has parser', () => {
        it('then the correct label should be added for logs query', () => {
          assertAdHocFilters('{bar="baz"} | logfmt', '{bar="baz",job="grafana"} | logfmt', ds);
        });
        it('then the correct label should be added for metrics query', () => {
          assertAdHocFilters('rate({bar="baz"} | logfmt [5m])', 'rate({bar="baz",job="grafana"} | logfmt [5m])', ds);
        });
      });
    });

    describe('when called with "!=" operator', () => {
      beforeEach(() => {
        adHocFilters = [
          {
            condition: '',
            key: 'job',
            operator: '!=',
            value: 'grafana',
          },
        ];
        const templateSrvMock = {
          getAdhocFilters: (): AdHocFilter[] => adHocFilters,
          replace: (a: string) => a,
        } as unknown as TemplateSrv;
        ds = createLokiDSForTests(templateSrvMock);
      });
      describe('and query has no parser', () => {
        it('then the correct label should be added for logs query', () => {
          assertAdHocFilters('{bar="baz"}', '{bar="baz",job!="grafana"}', ds);
        });

        it('then the correct label should be added for metrics query', () => {
          assertAdHocFilters('rate({bar="baz"}[5m])', 'rate({bar="baz",job!="grafana"}[5m])', ds);
        });
      });
      describe('and query has parser', () => {
        it('then the correct label should be added for logs query', () => {
          assertAdHocFilters('{bar="baz"} | logfmt', '{bar="baz",job!="grafana"} | logfmt', ds);
        });
        it('then the correct label should be added for metrics query', () => {
          assertAdHocFilters('rate({bar="baz"} | logfmt [5m])', 'rate({bar="baz",job!="grafana"} | logfmt [5m])', ds);
        });
      });
    });
  });

  describe('prepareLogRowContextQueryTarget', () => {
    const ds = createLokiDSForTests();
    it('creates query with only labels from /labels API', () => {
      const row: LogRowModel = {
        rowIndex: 0,
        dataFrame: new MutableDataFrame({
          fields: [
            {
              name: 'ts',
              type: FieldType.time,
              values: [0],
            },
          ],
        }),
        labels: { bar: 'baz', foo: 'uniqueParsedLabel' },
        uid: '1',
      } as any;

      //Mock stored labels to only include "bar" label
      jest.spyOn(ds.languageProvider, 'getLabelKeys').mockImplementation(() => ['bar']);
      const contextQuery = ds.prepareLogRowContextQueryTarget(row, 10, 'BACKWARD');

      expect(contextQuery.query.expr).toContain('baz');
      expect(contextQuery.query.expr).not.toContain('uniqueParsedLabel');
    });
  });

  describe('logs volume data provider', () => {
    it('creates provider for logs query', () => {
      const ds = createLokiDSForTests();
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{label=value}', refId: 'A' }],
      });

      expect(ds.getLogsVolumeDataProvider(options)).toBeDefined();
    });

    it('does not create provider for metrics query', () => {
      const ds = createLokiDSForTests();
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: 'rate({label=value}[1m])', refId: 'A' }],
      });

      expect(ds.getLogsVolumeDataProvider(options)).not.toBeDefined();
    });

    it('creates provider if at least one query is a logs query', () => {
      const ds = createLokiDSForTests();
      const options = getQueryOptions<LokiQuery>({
        targets: [
          { expr: 'rate({label=value}[1m])', refId: 'A' },
          { expr: '{label=value}', refId: 'B' },
        ],
      });

      expect(ds.getLogsVolumeDataProvider(options)).toBeDefined();
    });

    it('does not create provider if there is only an instant logs query', () => {
      const ds = createLokiDSForTests();
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{label=value', refId: 'A', queryType: LokiQueryType.Instant }],
      });

      expect(ds.getLogsVolumeDataProvider(options)).not.toBeDefined();
    });
  });

  describe('importing queries', () => {
    it('keeps all labels when no labels are loaded', async () => {
      const ds = createLokiDSForTests();
      ds.getResource = () => Promise.resolve({ data: [] });
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
      const ds = createLokiDSForTests();
      ds.getResource = () => Promise.resolve({ data: ['foo'] });
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
});

describe('isMetricsQuery', () => {
  it('should return true for metrics query', () => {
    const query = 'rate({label=value}[1m])';
    expect(isMetricsQuery(query)).toBeTruthy();
  });

  it('should return false for logs query', () => {
    const query = '{label=value}';
    expect(isMetricsQuery(query)).toBeFalsy();
  });

  it('should not blow up on empty query', () => {
    const query = '';
    expect(isMetricsQuery(query)).toBeFalsy();
  });
});

describe('applyTemplateVariables', () => {
  it('should add the adhoc filter to the query', () => {
    const ds = createLokiDSForTests();
    const spy = jest.spyOn(ds, 'addAdHocFilters');
    ds.applyTemplateVariables({ expr: '{test}', refId: 'A' }, {});
    expect(spy).toHaveBeenCalledWith('{test}');
  });
});

function assertAdHocFilters(query: string, expectedResults: string, ds: LokiDatasource) {
  const lokiQuery: LokiQuery = { refId: 'A', expr: query };
  const result = ds.addAdHocFilters(lokiQuery.expr);

  expect(result).toEqual(expectedResults);
}

function createLokiDSForTests(
  templateSrvMock = {
    getAdhocFilters: (): any[] => [],
    replace: (a: string) => a,
  } as unknown as TemplateSrv
): LokiDatasource {
  const instanceSettings: any = {
    url: 'myloggingurl',
  };

  const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
  const customSettings = { ...instanceSettings, jsonData: customData };

  return new LokiDatasource(customSettings, templateSrvMock, timeSrvStub as any);
}

function makeAnnotationQueryRequest(options: any): AnnotationQueryRequest<LokiQuery> {
  const timeRange = {
    from: dateTime(),
    to: dateTime(),
  };
  return {
    annotation: {
      expr: '{test=test}',
      refId: '',
      datasource: 'loki',
      enable: true,
      name: 'test-annotation',
      iconColor: 'red',
      ...options,
    },
    dashboard: {
      id: 1,
    } as any,
    range: {
      ...timeRange,
      raw: timeRange,
    },
    rangeRaw: timeRange,
  };
}
