import { lastValueFrom, of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { getQueryOptions } from 'test/helpers/getQueryOptions';

import {
  AbstractLabelOperator,
  AnnotationQueryRequest,
  CoreApp,
  DataFrame,
  dateTime,
  FieldCache,
  FieldType,
  LogRowModel,
  MutableDataFrame,
  toUtc,
} from '@grafana/data';
import { BackendSrvRequest, FetchResponse } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { initialCustomVariableModelState } from '../../../features/variables/custom/reducer';
import { CustomVariableModel } from '../../../features/variables/types';

import { isMetricsQuery, LokiDatasource, RangeQueryOptions } from './datasource';
import { makeMockLokiDatasource } from './mocks';
import { LokiQuery, LokiResponse, LokiResultType } from './types';

jest.mock('@grafana/runtime', () => ({
  // @ts-ignore
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

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

const testLogsResponse: FetchResponse<LokiResponse> = {
  data: {
    data: {
      resultType: LokiResultType.Stream,
      result: [
        {
          stream: {},
          values: [['1573646419522934000', 'hello']],
        },
      ],
    },
    status: 'success',
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

const testMetricsResponse: FetchResponse<LokiResponse> = {
  data: {
    data: {
      resultType: LokiResultType.Matrix,
      result: [
        {
          metric: {},
          values: [[1605715380, '1.1']],
        },
      ],
    },
    status: 'success',
  },
  ok: true,
  headers: {} as unknown as Headers,
  redirected: false,
  status: 200,
  statusText: 'OK',
  type: 'basic',
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
  const fetchMock = jest.spyOn(backendSrv, 'fetch');

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockImplementation(() => of(createFetchResponse({})));
  });

  describe('when creating range query', () => {
    let ds: LokiDatasource;
    let adjustIntervalSpy: jest.SpyInstance;

    beforeEach(() => {
      ds = createLokiDSForTests();
      adjustIntervalSpy = jest.spyOn(ds, 'adjustInterval');
    });

    it('should use default intervalMs if one is not provided', () => {
      const target = { expr: '{job="grafana"}', refId: 'B' };
      const raw = { from: 'now', to: 'now-1h' };
      const range = { from: dateTime(), to: dateTime(), raw: raw };
      const options = {
        range,
      };

      const req = ds.createRangeQuery(target, options as any, 1000);
      expect(req.start).toBeDefined();
      expect(req.end).toBeDefined();
      expect(adjustIntervalSpy).toHaveBeenCalledWith(1000, 1, expect.anything());
    });

    it('should use provided intervalMs', () => {
      const target = { expr: '{job="grafana"}', refId: 'B' };
      const raw = { from: 'now', to: 'now-1h' };
      const range = { from: dateTime(), to: dateTime(), raw: raw };
      const options = {
        range,
        intervalMs: 2000,
      };

      const req = ds.createRangeQuery(target, options as any, 1000);
      expect(req.start).toBeDefined();
      expect(req.end).toBeDefined();
      expect(adjustIntervalSpy).toHaveBeenCalledWith(2000, 1, expect.anything());
    });

    it('should set the minimal step to 1ms', () => {
      const target = { expr: '{job="grafana"}', refId: 'B' };
      const raw = { from: 'now', to: 'now-1h' };
      const range = { from: dateTime('2020-10-14T00:00:00'), to: dateTime('2020-10-14T00:00:01'), raw: raw };
      const options = {
        range,
        intervalMs: 0.0005,
      };

      const req = ds.createRangeQuery(target, options as any, 1000);
      expect(req.start).toBeDefined();
      expect(req.end).toBeDefined();
      expect(adjustIntervalSpy).toHaveBeenCalledWith(0.0005, expect.anything(), 1000);
      // Step is in seconds (1 ms === 0.001 s)
      expect(req.step).toEqual(0.001);
    });

    describe('log volume hint', () => {
      let options: RangeQueryOptions;

      beforeEach(() => {
        const raw = { from: 'now', to: 'now-1h' };
        const range = { from: dateTime(), to: dateTime(), raw: raw };
        options = {
          range,
        } as unknown as RangeQueryOptions;
      });

      it('should add volume hint param for log volume queries', () => {
        const target = { expr: '{job="grafana"}', refId: 'B', volumeQuery: true };
        ds.runRangeQuery(target, options);
        expect(backendSrv.fetch).toBeCalledWith(
          expect.objectContaining({
            headers: {
              'X-Query-Tags': 'Source=logvolhist',
            },
          })
        );
      });

      it('should not add volume hint param for regular queries', () => {
        const target = { expr: '{job="grafana"}', refId: 'B', volumeQuery: false };
        ds.runRangeQuery(target, options);
        expect(backendSrv.fetch).not.toBeCalledWith(
          expect.objectContaining({
            headers: {
              'X-Query-Tags': 'Source=logvolhist',
            },
          })
        );
      });
    });
  });

  describe('when doing logs queries with limits', () => {
    const runLimitTest = async ({
      maxDataPoints = 123,
      queryMaxLines,
      dsMaxLines = 456,
      expectedLimit,
      expr = '{label="val"}',
    }: any) => {
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

      const options = getQueryOptions<LokiQuery>({ targets: [{ expr, refId: 'B', maxLines: queryMaxLines }] });
      options.maxDataPoints = maxDataPoints;

      fetchMock.mockImplementation(() => of(testLogsResponse));

      await expect(ds.query(options).pipe(take(1))).toEmitValuesWith(() => {
        expect(fetchMock.mock.calls.length).toBe(1);
        expect(fetchMock.mock.calls[0][0].url).toContain(`limit=${expectedLimit}`);
      });
    };

    it('should use datasource max lines when no limit given and it is log query', async () => {
      await runLimitTest({ expectedLimit: 456 });
    });

    it('should use custom max lines from query if set and it is logs query', async () => {
      await runLimitTest({ queryMaxLines: 20, expectedLimit: 20 });
    });

    it('should use custom max lines from query if set and it is logs query even if it is higher than data source limit', async () => {
      await runLimitTest({ queryMaxLines: 500, expectedLimit: 500 });
    });

    it('should use maxDataPoints if it is metrics query', async () => {
      await runLimitTest({ expr: 'rate({label="val"}[10m])', expectedLimit: 123 });
    });

    it('should use maxDataPoints if it is metrics query and using search', async () => {
      await runLimitTest({ expr: 'rate({label="val"}[10m])', expectedLimit: 123 });
    });
  });

  describe('when querying', () => {
    function setup(expr: string, app: CoreApp, instant?: boolean, range?: boolean) {
      const ds = createLokiDSForTests();
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr, refId: 'B', instant, range }],
        app,
      });
      ds.runInstantQuery = jest.fn(() => of({ data: [] }));
      ds.runRangeQuery = jest.fn(() => of({ data: [] }));
      return { ds, options };
    }

    const metricsQuery = 'rate({job="grafana"}[10m])';
    const logsQuery = '{job="grafana"} |= "foo"';

    it('should run logs instant if only instant is selected', async () => {
      const { ds, options } = setup(logsQuery, CoreApp.Explore, true, false);
      await lastValueFrom(ds.query(options));
      expect(ds.runInstantQuery).toBeCalled();
      expect(ds.runRangeQuery).not.toBeCalled();
    });

    it('should run metrics instant if only instant is selected', async () => {
      const { ds, options } = setup(metricsQuery, CoreApp.Explore, true, false);
      lastValueFrom(await ds.query(options));
      expect(ds.runInstantQuery).toBeCalled();
      expect(ds.runRangeQuery).not.toBeCalled();
    });

    it('should run only logs range query if only range is selected', async () => {
      const { ds, options } = setup(logsQuery, CoreApp.Explore, false, true);
      lastValueFrom(await ds.query(options));
      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQuery).toBeCalled();
    });

    it('should run only metrics range query if only range is selected', async () => {
      const { ds, options } = setup(metricsQuery, CoreApp.Explore, false, true);
      lastValueFrom(await ds.query(options));
      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQuery).toBeCalled();
    });

    it('should run only logs range query if no query type is selected in Explore', async () => {
      const { ds, options } = setup(logsQuery, CoreApp.Explore);
      lastValueFrom(await ds.query(options));
      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQuery).toBeCalled();
    });

    it('should run only metrics range query if no query type is selected in Explore', async () => {
      const { ds, options } = setup(metricsQuery, CoreApp.Explore);
      lastValueFrom(await ds.query(options));
      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQuery).toBeCalled();
    });

    it('should run only logs range query in Dashboard', async () => {
      const { ds, options } = setup(logsQuery, CoreApp.Dashboard);
      lastValueFrom(await ds.query(options));
      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQuery).toBeCalled();
    });

    it('should run only metrics range query in Dashboard', async () => {
      const { ds, options } = setup(metricsQuery, CoreApp.Dashboard);
      lastValueFrom(await ds.query(options));
      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQuery).toBeCalled();
    });

    it('should return dataframe data for metrics range queries', async () => {
      const ds = createLokiDSForTests();
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: metricsQuery, refId: 'B', range: true }],
        app: CoreApp.Explore,
      });

      fetchMock.mockImplementation(() => of(testMetricsResponse));

      await expect(ds.query(options)).toEmitValuesWith((received) => {
        const result = received[0];
        const frame = result.data[0] as DataFrame;

        expect(frame.meta?.preferredVisualisationType).toBe('graph');
        expect(frame.refId).toBe('B');
        frame.fields.forEach((field) => {
          const value = field.values.get(0);

          if (field.type === FieldType.time) {
            expect(value).toBe(1605715380000);
          } else {
            expect(value).toBe(1.1);
          }
        });
      });
    });

    it('should return series data for logs range query', async () => {
      const ds = createLokiDSForTests();
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: logsQuery, refId: 'B' }],
      });

      fetchMock.mockImplementation(() => of(testLogsResponse));

      await expect(ds.query(options)).toEmitValuesWith((received) => {
        const result = received[0];
        const dataFrame = result.data[0] as DataFrame;
        const fieldCache = new FieldCache(dataFrame);

        expect(fieldCache.getFieldByName('Line')?.values.get(0)).toBe('hello');
        expect(dataFrame.meta?.limit).toBe(20);
        expect(dataFrame.meta?.searchWords).toEqual(['foo']);
      });
    });

    it('should return custom error message when Loki returns escaping error', async () => {
      const ds = createLokiDSForTests();
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{job="gra\\fana"}', refId: 'B' }],
      });

      fetchMock.mockImplementation(() =>
        throwError({
          data: {
            message: 'parse error at line 1, col 6: invalid char escape',
          },
          status: 400,
          statusText: 'Bad Request',
        })
      );

      await expect(ds.query(options)).toEmitValuesWith((received) => {
        const err: any = received[0];
        expect(err.data.message).toBe(
          'Error: parse error at line 1, col 6: invalid char escape. Make sure that all special characters are escaped with \\. For more information on escaping of special characters visit LogQL documentation at https://grafana.com/docs/loki/latest/logql/.'
        );
      });
    });

    describe('When using adhoc filters', () => {
      const DEFAULT_EXPR = 'rate({bar="baz", job="foo"} |= "bar" [5m])';
      const options = {
        targets: [{ expr: DEFAULT_EXPR }],
      };
      const originalAdhocFiltersMock = templateSrvStub.getAdhocFilters();
      const ds = new LokiDatasource({} as any, templateSrvStub as any, timeSrvStub as any);
      ds.runRangeQuery = jest.fn(() => of({ data: [] }));

      afterAll(() => {
        templateSrvStub.getAdhocFilters.mockReturnValue(originalAdhocFiltersMock);
      });

      it('should not modify expression with no filters', async () => {
        await lastValueFrom(ds.query(options as any));
        expect(ds.runRangeQuery).toBeCalledWith({ expr: DEFAULT_EXPR }, expect.anything());
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

        await lastValueFrom(ds.query(options as any));
        expect(ds.runRangeQuery).toBeCalledWith(
          { expr: 'rate({bar="baz",job="foo",k1="v1",k2!="v2"} |= "bar" [5m])' },
          expect.anything()
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
        await lastValueFrom(ds.query(options as any));
        expect(ds.runRangeQuery).toBeCalledWith(
          { expr: 'rate({bar="baz",job="foo",k1=~"v\\\\.\\\\*",k2=~"v\'\\\\.\\\\*"} |= "bar" [5m])' },
          expect.anything()
        );
      });
    });

    describe('__range, __range_s and __range_ms variables', () => {
      const options = {
        targets: [{ expr: 'rate(process_cpu_seconds_total[$__range])', refId: 'A', stepInterval: '2s' }],
        range: {
          from: rawRange.from,
          to: rawRange.to,
          raw: rawRange,
        },
      };

      const ds = new LokiDatasource({} as any, templateSrvStub as any, timeSrvStub as any);

      beforeEach(() => {
        templateSrvStub.replace.mockClear();
      });

      it('should be correctly interpolated', () => {
        ds.query(options as any);
        const range = templateSrvStub.replace.mock.calls[0][1].__range;
        const rangeMs = templateSrvStub.replace.mock.calls[0][1].__range_ms;
        const rangeS = templateSrvStub.replace.mock.calls[0][1].__range_s;
        expect(range).toEqual({ text: '3600s', value: '3600s' });
        expect(rangeMs).toEqual({ text: 3600000, value: 3600000 });
        expect(rangeS).toEqual({ text: 3600, value: 3600 });
      });
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
    const getTestContext = (response: any, options: any = []) => {
      const query = makeAnnotationQueryRequest(options);
      fetchMock.mockImplementation(() => of(response));

      const ds = createLokiDSForTests();
      const promise = ds.annotationQuery(query);

      return { promise };
    };

    it('should transform the loki data to annotation response', async () => {
      const response: FetchResponse = {
        data: {
          data: {
            resultType: LokiResultType.Stream,
            result: [
              {
                stream: {
                  label: 'value',
                  label2: 'value ',
                },
                values: [['1549016857498000000', 'hello']],
              },
              {
                stream: {
                  label: '', // empty value gets filtered
                  label2: 'value2',
                  label3: ' ', // whitespace value gets trimmed then filtered
                },
                values: [['1549024057498000000', 'hello 2']],
              },
            ],
          },
          status: 'success',
        },
      } as unknown as FetchResponse;
      const { promise } = getTestContext(response, { stepInterval: '15s' });

      const res = await promise;

      expect(res.length).toBe(2);
      expect(res[0].text).toBe('hello');
      expect(res[0].tags).toEqual(['value']);

      expect(res[1].text).toBe('hello 2');
      expect(res[1].tags).toEqual(['value2']);
    });
    describe('Formatting', () => {
      const response: FetchResponse = {
        data: {
          data: {
            resultType: LokiResultType.Stream,
            result: [
              {
                stream: {
                  label: 'value',
                  label2: 'value2',
                  label3: 'value3',
                },
                values: [['1549016857498000000', 'hello']],
              },
            ],
          },
          status: 'success',
        },
      } as unknown as FetchResponse;
      describe('When tagKeys is set', () => {
        it('should only include selected labels', async () => {
          const { promise } = getTestContext(response, { tagKeys: 'label2,label3', stepInterval: '15s' });

          const res = await promise;

          expect(res.length).toBe(1);
          expect(res[0].text).toBe('hello');
          expect(res[0].tags).toEqual(['value2', 'value3']);
        });
      });
      describe('When textFormat is set', () => {
        it('should fromat the text accordingly', async () => {
          const { promise } = getTestContext(response, { textFormat: 'hello {{label2}}', stepInterval: '15s' });

          const res = await promise;

          expect(res.length).toBe(1);
          expect(res[0].text).toBe('hello value2');
        });
      });
      describe('When titleFormat is set', () => {
        it('should fromat the title accordingly', async () => {
          const { promise } = getTestContext(response, { titleFormat: 'Title {{label2}}', stepInterval: '15s' });

          const res = await promise;

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

  describe('adjustInterval', () => {
    const dynamicInterval = 15;
    const range = 1642;
    const resolution = 1;
    const ds = createLokiDSForTests();
    it('should return the interval as a factor of dynamicInterval and resolution', () => {
      let interval = ds.adjustInterval(dynamicInterval, resolution, range);
      expect(interval).toBe(resolution * dynamicInterval);
    });
    it('should not return a value less than the safe interval', () => {
      let safeInterval = range / 11000;
      if (safeInterval > 1) {
        safeInterval = Math.ceil(safeInterval);
      }
      const unsafeInterval = safeInterval - 0.01;
      let interval = ds.adjustInterval(unsafeInterval, resolution, range);
      expect(interval).toBeGreaterThanOrEqual(safeInterval);
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
  });

  describe('importing queries', () => {
    it('keeps all labels when no labels are loaded', async () => {
      const ds = createLokiDSForTests();
      fetchMock.mockImplementation(() => of(createFetchResponse({ data: [] })));
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
      fetchMock.mockImplementation(() => of(createFetchResponse({ data: ['foo'] })));
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
