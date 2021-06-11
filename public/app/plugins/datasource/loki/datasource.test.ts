import { of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { AnnotationQueryRequest, CoreApp, DataFrame, dateTime, FieldCache, TimeSeries } from '@grafana/data';
import { BackendSrvRequest, FetchResponse } from '@grafana/runtime';

import LokiDatasource from './datasource';
import { LokiQuery, LokiResponse, LokiResultType } from './types';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { CustomVariableModel } from '../../../features/variables/types';
import { initialCustomVariableModelState } from '../../../features/variables/custom/reducer';
import { makeMockLokiDatasource } from './mocks';
import { createFetchResponse } from 'test/helpers/createFetchResponse';

jest.mock('@grafana/runtime', () => ({
  // @ts-ignore
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

const timeSrvStub = {
  timeRange: () => ({
    from: new Date(0),
    to: new Date(1),
  }),
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
  headers: ({} as unknown) as Headers,
  redirected: false,
  status: 200,
  statusText: 'Success',
  type: 'default',
  url: '',
  config: ({} as unknown) as BackendSrvRequest,
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
  headers: ({} as unknown) as Headers,
  redirected: false,
  status: 200,
  statusText: 'OK',
  type: 'basic',
  url: '',
  config: ({} as unknown) as BackendSrvRequest,
};

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
      expect(adjustIntervalSpy).toHaveBeenCalledWith(1000, expect.anything());
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
      expect(adjustIntervalSpy).toHaveBeenCalledWith(2000, expect.anything());
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
      expect(adjustIntervalSpy).toHaveBeenCalledWith(0.0005, expect.anything());
      // Step is in seconds (1 ms === 0.001 s)
      expect(req.step).toEqual(0.001);
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

      const templateSrvMock = ({
        getAdhocFilters: (): any[] => [],
        replace: (a: string) => a,
      } as unknown) as TemplateSrv;

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
      await ds.query(options).toPromise();
      expect(ds.runInstantQuery).toBeCalled();
      expect(ds.runRangeQuery).not.toBeCalled();
    });

    it('should run metrics instant if only instant is selected', async () => {
      const { ds, options } = setup(metricsQuery, CoreApp.Explore, true, false);
      await ds.query(options).toPromise();
      expect(ds.runInstantQuery).toBeCalled();
      expect(ds.runRangeQuery).not.toBeCalled();
    });

    it('should run only logs range query if only range is selected', async () => {
      const { ds, options } = setup(logsQuery, CoreApp.Explore, false, true);
      await ds.query(options).toPromise();
      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQuery).toBeCalled();
    });

    it('should run only metrics range query if only range is selected', async () => {
      const { ds, options } = setup(metricsQuery, CoreApp.Explore, false, true);
      await ds.query(options).toPromise();
      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQuery).toBeCalled();
    });

    it('should run only logs range query if no query type is selected in Explore', async () => {
      const { ds, options } = setup(logsQuery, CoreApp.Explore);
      await ds.query(options).toPromise();
      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQuery).toBeCalled();
    });

    it('should run only metrics range query if no query type is selected in Explore', async () => {
      const { ds, options } = setup(metricsQuery, CoreApp.Explore);
      await ds.query(options).toPromise();
      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQuery).toBeCalled();
    });

    it('should run only logs range query in Dashboard', async () => {
      const { ds, options } = setup(logsQuery, CoreApp.Dashboard);
      await ds.query(options).toPromise();
      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQuery).toBeCalled();
    });

    it('should run only metrics range query in Dashboard', async () => {
      const { ds, options } = setup(metricsQuery, CoreApp.Dashboard);
      await ds.query(options).toPromise();
      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQuery).toBeCalled();
    });

    it('should return series data for metrics range queries', async () => {
      const ds = createLokiDSForTests();
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: metricsQuery, refId: 'B', range: true }],
        app: CoreApp.Explore,
      });

      fetchMock.mockImplementation(() => of(testMetricsResponse));

      await expect(ds.query(options)).toEmitValuesWith((received) => {
        const result = received[0];
        const timeSeries = result.data[0] as TimeSeries;

        expect(timeSeries.meta?.preferredVisualisationType).toBe('graph');
        expect(timeSeries.refId).toBe('B');
        expect(timeSeries.datapoints[0]).toEqual([1.1, 1605715380000]);
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

        expect(fieldCache.getFieldByName('line')?.values.get(0)).toBe('hello');
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
    describe('and call succeeds', () => {
      it('should return successfully', async () => {
        fetchMock.mockImplementation(() => of(createFetchResponse({ values: ['avalue'] })));
        const ds = createLokiDSForTests({} as TemplateSrv);

        const result = await ds.testDatasource();

        expect(result.status).toBe('success');
      });
    });

    describe('and call fails with 401 error', () => {
      it('should return error status and a detailed error message', async () => {
        fetchMock.mockImplementation(() =>
          throwError({
            statusText: 'Unauthorized',
            status: 401,
            data: {
              message: 'Unauthorized',
            },
          })
        );
        const ds = createLokiDSForTests({} as TemplateSrv);

        const result = await ds.testDatasource();

        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Unauthorized. 401. Unauthorized');
      });
    });

    describe('and call fails with 404 error', () => {
      it('should return error status and a detailed error message', async () => {
        fetchMock.mockImplementation(() =>
          throwError({
            statusText: 'Not found',
            status: 404,
            data: {
              message: '404 page not found',
            },
          })
        );

        const ds = createLokiDSForTests({} as TemplateSrv);

        const result = await ds.testDatasource();

        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Not found. 404. 404 page not found');
      });
    });

    describe('and call fails with 502 error', () => {
      it('should return error status and a detailed error message', async () => {
        fetchMock.mockImplementation(() =>
          throwError({
            statusText: 'Bad Gateway',
            status: 502,
            data: '',
          })
        );

        const ds = createLokiDSForTests({} as TemplateSrv);

        const result = await ds.testDatasource();

        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Bad Gateway. 502');
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
      const response: FetchResponse = ({
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
      } as unknown) as FetchResponse;
      const { promise } = getTestContext(response);

      const res = await promise;

      expect(res.length).toBe(2);
      expect(res[0].text).toBe('hello');
      expect(res[0].tags).toEqual(['value']);

      expect(res[1].text).toBe('hello 2');
      expect(res[1].tags).toEqual(['value2']);
    });
    describe('Formatting', () => {
      const response: FetchResponse = ({
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
      } as unknown) as FetchResponse;
      describe('When tagKeys is set', () => {
        it('should only include selected labels', async () => {
          const { promise } = getTestContext(response, { tagKeys: 'label2,label3' });

          const res = await promise;

          expect(res.length).toBe(1);
          expect(res[0].text).toBe('hello');
          expect(res[0].tags).toEqual(['value2', 'value3']);
        });
      });
      describe('When textFormat is set', () => {
        it('should fromat the text accordingly', async () => {
          const { promise } = getTestContext(response, { textFormat: 'hello {{label2}}' });

          const res = await promise;

          expect(res.length).toBe(1);
          expect(res[0].text).toBe('hello value2');
        });
      });
      describe('When titleFormat is set', () => {
        it('should fromat the title accordingly', async () => {
          const { promise } = getTestContext(response, { titleFormat: 'Title {{label2}}' });

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
});

function createLokiDSForTests(
  templateSrvMock = ({
    getAdhocFilters: (): any[] => [],
    replace: (a: string) => a,
  } as unknown) as TemplateSrv
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
