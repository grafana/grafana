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
  DataSourceInstanceSettings,
  dateTime,
  FieldType,
  LogRowModel,
  MutableDataFrame,
} from '@grafana/data';
import { BackendSrvRequest, FetchResponse, setBackendSrv, getBackendSrv, BackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { initialCustomVariableModelState } from '../../../features/variables/custom/reducer';
import { CustomVariableModel } from '../../../features/variables/types';

import { LokiDatasource } from './datasource';
import { createMetadataRequest, createLokiDatasource } from './mocks';
import { LokiOptions, LokiQuery, LokiQueryType } from './types';

const templateSrvStub = {
  getAdhocFilters: jest.fn(() => [] as unknown[]),
  replace: jest.fn((a: string, ...rest: unknown[]) => a),
} as unknown as TemplateSrv;

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
      dsMaxLines: string | undefined,
      expectedMaxLines: number
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
      await runTest(undefined, '40', 40);
    });

    it('should use query max lines, if exists', async () => {
      await runTest(80, undefined, 80);
    });

    it('should use query max lines, if both exist, even if it is higher than ds max lines', async () => {
      await runTest(80, '40', 80);
    });
  });

  describe('When using adhoc filters', () => {
    const DEFAULT_EXPR = 'rate({bar="baz", job="foo"} |= "bar" [5m])';
    const query: LokiQuery = { expr: DEFAULT_EXPR, refId: 'A' };
    const mockedGetAdhocFilters = templateSrvStub.getAdhocFilters as jest.Mock;
    const ds = createLokiDatasource(templateSrvStub);

    it('should not modify expression with no filters', async () => {
      expect(ds.applyTemplateVariables(query, {}).expr).toBe(DEFAULT_EXPR);
    });

    it('should add filters to expression', async () => {
      mockedGetAdhocFilters.mockReturnValue([
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
        'rate({bar="baz", job="foo", k1="v1", k2!="v2"} |= "bar" [5m])'
      );
    });

    it('should add escaping if needed to regex filter expressions', async () => {
      mockedGetAdhocFilters.mockReturnValue([
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
        'rate({bar="baz", job="foo", k1=~"v\\\\.\\\\*", k2=~"v\'\\\\.\\\\*"} |= "bar" [5m])'
      );
    });
  });

  describe('when interpolating variables', () => {
    let ds: LokiDatasource;
    let variable: CustomVariableModel;

    beforeEach(() => {
      ds = createLokiDatasource(templateSrvStub);
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
    let ds: LokiDatasource;
    beforeEach(() => {
      ds = createLokiDatasource(templateSrvStub);
    });

    it('should return successfully when call succeeds with labels', async () => {
      ds.metadataRequest = () => Promise.resolve(['avalue']);

      const result = await ds.testDatasource();

      expect(result).toStrictEqual({
        status: 'success',
        message: 'Data source connected and labels found.',
      });
    });

    it('should return error when call succeeds without labels', async () => {
      ds.metadataRequest = () => Promise.resolve([]);

      const result = await ds.testDatasource();

      expect(result).toStrictEqual({
        status: 'error',
        message: 'Data source connected, but no labels received. Verify that Loki and Promtail is configured properly.',
      });
    });

    it('should return error status with no details when call fails with no details', async () => {
      ds.metadataRequest = () => Promise.reject({});

      const result = await ds.testDatasource();

      expect(result).toStrictEqual({
        status: 'error',
        message: 'Unable to fetch labels from Loki, please check the server logs for more details',
      });
    });

    it('should return error status with details when call fails with details', async () => {
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

    it(`should return label names for Loki`, async () => {
      const { ds } = getTestContext();

      const res = await ds.metricFindQuery('label_names()');

      expect(res).toEqual([{ text: 'label1' }, { text: 'label2' }]);
    });

    it(`should return label values for Loki when no matcher`, async () => {
      const { ds } = getTestContext();

      const res = await ds.metricFindQuery('label_values(label1)');

      expect(res).toEqual([{ text: 'value1' }, { text: 'value2' }]);
    });

    it(`should return label values for Loki with matcher`, async () => {
      const { ds } = getTestContext();

      const res = await ds.metricFindQuery('label_values({label1="value1", label2="value2"},label5)');

      expect(res).toEqual([{ text: 'value5' }]);
    });

    it(`should return empty array when incorrect query for Loki`, async () => {
      const { ds } = getTestContext();

      const res = await ds.metricFindQuery('incorrect_query');

      expect(res).toEqual([]);
    });
  });

  describe('modifyQuery', () => {
    describe('when called with ADD_FILTER', () => {
      let ds: LokiDatasource;
      beforeEach(() => {
        ds = createLokiDatasource(templateSrvStub);
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
    });

    describe('when called with ADD_FILTER_OUT', () => {
      describe('and query has no parser', () => {
        let ds: LokiDatasource;
        beforeEach(() => {
          ds = createLokiDatasource(templateSrvStub);
        });

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
        describe('and query has parser', () => {
          let ds: LokiDatasource;
          beforeEach(() => {
            ds = createLokiDatasource(templateSrvStub);
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
        ds = createLokiDatasource(templateSrvMock);
      });
      describe('and query has no parser', () => {
        it('then the correct label should be added for logs query', () => {
          assertAdHocFilters('{bar="baz"}', '{bar="baz", job="grafana"}', ds);
        });

        it('then the correct label should be added for metrics query', () => {
          assertAdHocFilters('rate({bar="baz"}[5m])', 'rate({bar="baz", job="grafana"}[5m])', ds);
        });
      });
      describe('and query has parser', () => {
        it('then the correct label should be added for logs query', () => {
          assertAdHocFilters('{bar="baz"} | logfmt', '{bar="baz"} | logfmt | job=`grafana`', ds);
        });
        it('then the correct label should be added for metrics query', () => {
          assertAdHocFilters('rate({bar="baz"} | logfmt [5m])', 'rate({bar="baz"} | logfmt | job=`grafana` [5m])', ds);
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
        ds = createLokiDatasource(templateSrvMock);
      });
      describe('and query has no parser', () => {
        it('then the correct label should be added for logs query', () => {
          assertAdHocFilters('{bar="baz"}', '{bar="baz", job!="grafana"}', ds);
        });

        it('then the correct label should be added for metrics query', () => {
          assertAdHocFilters('rate({bar="baz"}[5m])', 'rate({bar="baz", job!="grafana"}[5m])', ds);
        });
      });
      describe('and query has parser', () => {
        it('then the correct label should be added for logs query', () => {
          assertAdHocFilters('{bar="baz"} | logfmt', '{bar="baz"} | logfmt | job!=`grafana`', ds);
        });
        it('then the correct label should be added for metrics query', () => {
          assertAdHocFilters('rate({bar="baz"} | logfmt [5m])', 'rate({bar="baz"} | logfmt | job!=`grafana` [5m])', ds);
        });
      });
    });
  });

  describe('prepareLogRowContextQueryTarget', () => {
    const ds = createLokiDatasource(templateSrvStub);
    it('creates query with only labels from /labels API', async () => {
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
      } as unknown as LogRowModel;

      //Mock stored labels to only include "bar" label
      jest.spyOn(ds.languageProvider, 'start').mockImplementation(() => Promise.resolve([]));
      jest.spyOn(ds.languageProvider, 'getLabelKeys').mockImplementation(() => ['bar']);
      const contextQuery = await ds.prepareLogRowContextQueryTarget(row, 10, 'BACKWARD');

      expect(contextQuery.query.expr).toContain('baz');
      expect(contextQuery.query.expr).not.toContain('uniqueParsedLabel');
    });

    it('should call languageProvider.start to fetch labels', async () => {
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
      } as unknown as LogRowModel;

      //Mock stored labels to only include "bar" label
      jest.spyOn(ds.languageProvider, 'start').mockImplementation(() => Promise.resolve([]));
      await ds.prepareLogRowContextQueryTarget(row, 10, 'BACKWARD');

      expect(ds.languageProvider.start).toBeCalled();
    });
  });

  describe('logs volume data provider', () => {
    let ds: LokiDatasource;
    beforeEach(() => {
      ds = createLokiDatasource(templateSrvStub);
    });

    it('creates provider for logs query', () => {
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{label=value}', refId: 'A' }],
      });

      expect(ds.getLogsVolumeDataProvider(options)).toBeDefined();
    });

    it('does not create provider for metrics query', () => {
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: 'rate({label=value}[1m])', refId: 'A' }],
      });

      expect(ds.getLogsVolumeDataProvider(options)).not.toBeDefined();
    });

    it('creates provider if at least one query is a logs query', () => {
      const options = getQueryOptions<LokiQuery>({
        targets: [
          { expr: 'rate({label=value}[1m])', refId: 'A' },
          { expr: '{label=value}', refId: 'B' },
        ],
      });

      expect(ds.getLogsVolumeDataProvider(options)).toBeDefined();
    });

    it('does not create provider if there is only an instant logs query', () => {
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{label=value', refId: 'A', queryType: LokiQueryType.Instant }],
      });

      expect(ds.getLogsVolumeDataProvider(options)).not.toBeDefined();
    });
  });

  describe('importing queries', () => {
    let ds: LokiDatasource;
    beforeEach(() => {
      ds = createLokiDatasource(templateSrvStub);
    });

    it('keeps all labels when no labels are loaded', async () => {
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

describe('applyTemplateVariables', () => {
  it('should add the adhoc filter to the query', () => {
    const ds = createLokiDatasource(templateSrvStub);
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
