import LokiDatasource from './datasource';
import { LokiQuery, LokiResultType, LokiResponse, LokiLegacyStreamResponse } from './types';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { AnnotationQueryRequest, DataSourceApi, DataFrame, dateTime } from '@grafana/data';
import { BackendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { CustomVariable } from 'app/features/templating/custom_variable';
import { ExploreMode } from 'app/types';
import { of } from 'rxjs';
import omit from 'lodash/omit';

describe('LokiDatasource', () => {
  const instanceSettings: any = {
    url: 'myloggingurl',
  };

  const legacyTestResp: { data: LokiLegacyStreamResponse; status: number } = {
    data: {
      streams: [
        {
          entries: [{ ts: '2019-02-01T10:27:37.498180581Z', line: 'hello' }],
          labels: '{}',
        },
      ],
    },
    status: 404, // for simulating legacy endpoint
  };

  const testResp: { data: LokiResponse } = {
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
  };

  const backendSrvMock = { datasourceRequest: jest.fn() };
  const backendSrv = (backendSrvMock as unknown) as BackendSrv;

  const templateSrvMock = ({
    getAdhocFilters: (): any[] => [],
    replace: (a: string) => a,
  } as unknown) as TemplateSrv;

  describe('when running range query with fallback', () => {
    let ds: LokiDatasource;
    beforeEach(() => {
      const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
      const customSettings = { ...instanceSettings, jsonData: customData };
      ds = new LokiDatasource(customSettings, backendSrv, templateSrvMock);
      backendSrvMock.datasourceRequest = jest.fn(() => Promise.resolve(legacyTestResp));
    });

    test('should try latest endpoint but fall back to legacy endpoint if it cannot be reached', async () => {
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{job="grafana"}', refId: 'B' }],
        exploreMode: ExploreMode.Logs,
      });

      ds.runLegacyQuery = jest.fn();
      await ds.runRangeQueryWithFallback(options.targets[0], options).toPromise();
      expect(ds.runLegacyQuery).toBeCalled();
    });
  });

  describe('when querying', () => {
    const testLimit = makeLimitTest(instanceSettings, backendSrvMock, backendSrv, templateSrvMock, legacyTestResp);
    let ds: LokiDatasource;

    beforeEach(() => {
      const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
      const customSettings = { ...instanceSettings, jsonData: customData };
      ds = new LokiDatasource(customSettings, backendSrv, templateSrvMock);
      backendSrvMock.datasourceRequest = jest.fn(() => Promise.resolve(testResp));
    });

    test('should run instant query and range query when in metrics mode', async () => {
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: 'rate({job="grafana"}[5m])', refId: 'A' }],
        exploreMode: ExploreMode.Metrics,
      });

      ds.runInstantQuery = jest.fn(() => of({ data: [] }));
      ds.runLegacyQuery = jest.fn();
      ds.runRangeQueryWithFallback = jest.fn(() => of({ data: [] }));
      await ds.query(options).toPromise();

      expect(ds.runInstantQuery).toBeCalled();
      expect(ds.runLegacyQuery).not.toBeCalled();
      expect(ds.runRangeQueryWithFallback).toBeCalled();
    });

    test('should just run range query when in logs mode', async () => {
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{job="grafana"}', refId: 'B' }],
        exploreMode: ExploreMode.Logs,
      });

      ds.runInstantQuery = jest.fn(() => of({ data: [] }));
      ds.runRangeQueryWithFallback = jest.fn(() => of({ data: [] }));
      await ds.query(options).toPromise();

      expect(ds.runInstantQuery).not.toBeCalled();
      expect(ds.runRangeQueryWithFallback).toBeCalled();
    });

    test('should use default max lines when no limit given', () => {
      testLimit({
        expectedLimit: 1000,
      });
    });

    test('should use custom max lines if limit is set', () => {
      testLimit({
        maxLines: 20,
        expectedLimit: 20,
      });
    });

    test('should use custom maxDataPoints if set in request', () => {
      testLimit({
        maxDataPoints: 500,
        expectedLimit: 500,
      });
    });

    test('should use datasource maxLimit if maxDataPoints is higher', () => {
      testLimit({
        maxLines: 20,
        maxDataPoints: 500,
        expectedLimit: 20,
      });
    });

    test('should return series data', async () => {
      const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
      const customSettings = { ...instanceSettings, jsonData: customData };
      const ds = new LokiDatasource(customSettings, backendSrv, templateSrvMock);
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockReturnValueOnce(Promise.resolve(legacyTestResp))
        .mockReturnValueOnce(Promise.resolve(omit(legacyTestResp, 'status')));

      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{job="grafana"} |= "foo"', refId: 'B' }],
      });

      const res = await ds.query(options).toPromise();

      const dataFrame = res.data[0] as DataFrame;
      expect(dataFrame.fields[1].values.get(0)).toBe('hello');
      expect(dataFrame.meta.limit).toBe(20);
      expect(dataFrame.meta.searchWords).toEqual(['foo']);
    });
  });

  describe('When interpolating variables', () => {
    let ds: LokiDatasource;
    let variable: CustomVariable;

    beforeEach(() => {
      const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
      const customSettings = { ...instanceSettings, jsonData: customData };
      ds = new LokiDatasource(customSettings, backendSrv, templateSrvMock);
      variable = new CustomVariable({}, {} as any);
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
    let ds: DataSourceApi<any, any>;
    let result: any;

    describe('and call succeeds', () => {
      beforeEach(async () => {
        const backendSrv = ({
          async datasourceRequest() {
            return Promise.resolve({
              status: 200,
              data: {
                values: ['avalue'],
              },
            });
          },
        } as unknown) as BackendSrv;
        ds = new LokiDatasource(instanceSettings, backendSrv, {} as TemplateSrv);
        result = await ds.testDatasource();
      });

      it('should return successfully', () => {
        expect(result.status).toBe('success');
      });
    });

    describe('and call fails with 401 error', () => {
      let ds: LokiDatasource;
      beforeEach(() => {
        backendSrvMock.datasourceRequest = jest.fn(() =>
          Promise.reject({
            statusText: 'Unauthorized',
            status: 401,
            data: {
              message: 'Unauthorized',
            },
          })
        );

        const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
        const customSettings = { ...instanceSettings, jsonData: customData };
        ds = new LokiDatasource(customSettings, backendSrv, templateSrvMock);
      });

      it('should return error status and a detailed error message', async () => {
        const result = await ds.testDatasource();
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Unauthorized. 401. Unauthorized');
      });
    });

    describe('and call fails with 404 error', () => {
      beforeEach(async () => {
        const backendSrv = ({
          async datasourceRequest() {
            return Promise.reject({
              statusText: 'Not found',
              status: 404,
              data: '404 page not found',
            });
          },
        } as unknown) as BackendSrv;
        ds = new LokiDatasource(instanceSettings, backendSrv, {} as TemplateSrv);
        result = await ds.testDatasource();
      });

      it('should return error status and a detailed error message', () => {
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Not found. 404. 404 page not found');
      });
    });

    describe('and call fails with 502 error', () => {
      beforeEach(async () => {
        const backendSrv = ({
          async datasourceRequest() {
            return Promise.reject({
              statusText: 'Bad Gateway',
              status: 502,
              data: '',
            });
          },
        } as unknown) as BackendSrv;
        ds = new LokiDatasource(instanceSettings, backendSrv, {} as TemplateSrv);
        result = await ds.testDatasource();
      });

      it('should return error status and a detailed error message', () => {
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Bad Gateway. 502');
      });
    });
  });

  describe('annotationQuery', () => {
    it('should transform the loki data to annotation response', async () => {
      const ds = new LokiDatasource(instanceSettings, backendSrv, templateSrvMock);
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockReturnValueOnce(
          Promise.resolve({
            data: [],
            status: 404,
          })
        )
        .mockReturnValueOnce(
          Promise.resolve({
            data: {
              streams: [
                {
                  entries: [{ ts: '2019-02-01T10:27:37.498180581Z', line: 'hello' }],
                  labels: '{label="value"}',
                },
                {
                  entries: [{ ts: '2019-02-01T12:27:37.498180581Z', line: 'hello 2' }],
                  labels: '{label2="value2"}',
                },
              ],
            },
          })
        );
      const query = makeAnnotationQueryRequest();

      const res = await ds.annotationQuery(query);
      expect(res.length).toBe(2);
      expect(res[0].text).toBe('hello');
      expect(res[0].tags).toEqual(['value']);

      expect(res[1].text).toBe('hello 2');
      expect(res[1].tags).toEqual(['value2']);
    });
  });
});

type LimitTestArgs = {
  maxDataPoints?: number;
  maxLines?: number;
  expectedLimit: number;
};
function makeLimitTest(
  instanceSettings: any,
  backendSrvMock: any,
  backendSrv: any,
  templateSrvMock: any,
  testResp: any
) {
  return ({ maxDataPoints, maxLines, expectedLimit }: LimitTestArgs) => {
    let settings = instanceSettings;
    if (Number.isFinite(maxLines)) {
      const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
      settings = { ...instanceSettings, jsonData: customData };
    }
    const ds = new LokiDatasource(settings, backendSrv, templateSrvMock);
    backendSrvMock.datasourceRequest = jest.fn(() => Promise.resolve(testResp));

    const options = getQueryOptions<LokiQuery>({ targets: [{ expr: 'foo', refId: 'B' }] });
    if (Number.isFinite(maxDataPoints)) {
      options.maxDataPoints = maxDataPoints;
    } else {
      // By default is 500
      delete options.maxDataPoints;
    }

    ds.query(options);

    expect(backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
    expect(backendSrvMock.datasourceRequest.mock.calls[0][0].url).toContain(`limit=${expectedLimit}`);
  };
}

function makeAnnotationQueryRequest(): AnnotationQueryRequest<LokiQuery> {
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
