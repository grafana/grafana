import LokiDatasource, { RangeQueryOptions } from './datasource';
import { LokiQuery, LokiResultType, LokiResponse, LokiLegacyStreamResponse } from './types';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import {
  AnnotationQueryRequest,
  DataSourceApi,
  DataFrame,
  dateTime,
  TimeRange,
  ExploreMode,
  FieldCache,
} from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { CustomVariable } from 'app/features/templating/custom_variable';
import { makeMockLokiDatasource } from './mocks';
import { of } from 'rxjs';
import omit from 'lodash/omit';
import { backendSrv } from 'app/core/services/backend_srv'; // will use the version in __mocks__

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

const datasourceRequestMock = jest.spyOn(backendSrv, 'datasourceRequest');

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

  beforeEach(() => {
    jest.clearAllMocks();
    datasourceRequestMock.mockImplementation(() => Promise.resolve());
  });

  const templateSrvMock = ({
    getAdhocFilters: (): any[] => [],
    replace: (a: string) => a,
  } as unknown) as TemplateSrv;

  describe('when creating range query', () => {
    let ds: LokiDatasource;
    let adjustIntervalSpy: jest.SpyInstance;
    beforeEach(() => {
      const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
      const customSettings = { ...instanceSettings, jsonData: customData };
      ds = new LokiDatasource(customSettings, templateSrvMock);
      adjustIntervalSpy = jest.spyOn(ds, 'adjustInterval');
    });

    it('should use default intervalMs if one is not provided', () => {
      const target = { expr: '{job="grafana"}', refId: 'B' };
      const raw = { from: 'now', to: 'now-1h' };
      const range = { from: dateTime(), to: dateTime(), raw: raw };
      const options = {
        range,
      };

      const req = ds.createRangeQuery(target, options);
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

      const req = ds.createRangeQuery(target, options);
      expect(req.start).toBeDefined();
      expect(req.end).toBeDefined();
      expect(adjustIntervalSpy).toHaveBeenCalledWith(2000, expect.anything());
    });
  });

  describe('when running range query with fallback', () => {
    let ds: LokiDatasource;
    beforeEach(() => {
      const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
      const customSettings = { ...instanceSettings, jsonData: customData };
      ds = new LokiDatasource(customSettings, templateSrvMock);
      datasourceRequestMock.mockImplementation(() => Promise.resolve(legacyTestResp));
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
    let ds: LokiDatasource;
    let testLimit: any;

    beforeAll(() => {
      testLimit = makeLimitTest(instanceSettings, datasourceRequestMock, templateSrvMock, legacyTestResp);
    });

    beforeEach(() => {
      const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
      const customSettings = { ...instanceSettings, jsonData: customData };
      ds = new LokiDatasource(customSettings, templateSrvMock);
      datasourceRequestMock.mockImplementation(() => Promise.resolve(testResp));
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
      const ds = new LokiDatasource(customSettings, templateSrvMock);
      datasourceRequestMock.mockImplementation(
        jest
          .fn()
          .mockReturnValueOnce(Promise.resolve(legacyTestResp))
          .mockReturnValueOnce(Promise.resolve(omit(legacyTestResp, 'status')))
      );

      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{job="grafana"} |= "foo"', refId: 'B' }],
      });

      const res = await ds.query(options).toPromise();

      const dataFrame = res.data[0] as DataFrame;
      const fieldCache = new FieldCache(dataFrame);
      expect(fieldCache.getFieldByName('line').values.get(0)).toBe('hello');
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
      ds = new LokiDatasource(customSettings, templateSrvMock);
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
        datasourceRequestMock.mockImplementation(async () => {
          return Promise.resolve({
            status: 200,
            data: {
              values: ['avalue'],
            },
          });
        });
        ds = new LokiDatasource(instanceSettings, {} as TemplateSrv);
        result = await ds.testDatasource();
      });

      it('should return successfully', () => {
        expect(result.status).toBe('success');
      });
    });

    describe('and call fails with 401 error', () => {
      let ds: LokiDatasource;
      beforeEach(() => {
        datasourceRequestMock.mockImplementation(() =>
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
        ds = new LokiDatasource(customSettings, templateSrvMock);
      });

      it('should return error status and a detailed error message', async () => {
        const result = await ds.testDatasource();
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Unauthorized. 401. Unauthorized');
      });
    });

    describe('and call fails with 404 error', () => {
      beforeEach(async () => {
        datasourceRequestMock.mockImplementation(() =>
          Promise.reject({
            statusText: 'Not found',
            status: 404,
            data: '404 page not found',
          })
        );
        ds = new LokiDatasource(instanceSettings, {} as TemplateSrv);
        result = await ds.testDatasource();
      });

      it('should return error status and a detailed error message', () => {
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Not found. 404. 404 page not found');
      });
    });

    describe('and call fails with 502 error', () => {
      beforeEach(async () => {
        datasourceRequestMock.mockImplementation(() =>
          Promise.reject({
            statusText: 'Bad Gateway',
            status: 502,
            data: '',
          })
        );
        ds = new LokiDatasource(instanceSettings, {} as TemplateSrv);
        result = await ds.testDatasource();
      });

      it('should return error status and a detailed error message', () => {
        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Bad Gateway. 502');
      });
    });
  });

  describe('when creating a range query', () => {
    const ds = new LokiDatasource(instanceSettings, templateSrvMock);
    const query: LokiQuery = { expr: 'foo', refId: 'bar' };

    // Loki v1 API has an issue with float step parameters, can be removed when API is fixed
    it('should produce an integer step parameter', () => {
      const range: TimeRange = {
        from: dateTime(0),
        to: dateTime(1e9 + 1),
        raw: { from: '0', to: '1000000001' },
      };
      // Odd timerange/interval combination that would lead to a float step
      const options: RangeQueryOptions = { range, intervalMs: 2000 };
      expect(Number.isInteger(ds.createRangeQuery(query, options).step)).toBeTruthy();
    });
  });

  describe('annotationQuery', () => {
    it('should transform the loki data to annotation response', async () => {
      const ds = new LokiDatasource(instanceSettings, templateSrvMock);
      datasourceRequestMock.mockImplementation(
        jest
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
          )
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

  describe('metricFindQuery', () => {
    const ds = new LokiDatasource(instanceSettings, templateSrvMock);
    const mocks = makeMetadataAndVersionsMocks();

    mocks.forEach((mock, index) => {
      it(`should return label names for Loki v${index}`, async () => {
        ds.getVersion = mock.getVersion;
        ds.metadataRequest = mock.metadataRequest;
        const query = 'label_names()';
        const res = await ds.metricFindQuery(query);
        expect(res[0].text).toEqual('label1');
        expect(res[1].text).toEqual('label2');
        expect(res.length).toBe(2);
      });
    });

    mocks.forEach((mock, index) => {
      it(`should return label names for Loki v${index}`, async () => {
        ds.getVersion = mock.getVersion;
        ds.metadataRequest = mock.metadataRequest;
        const query = 'label_names()';
        const res = await ds.metricFindQuery(query);
        expect(res[0].text).toEqual('label1');
        expect(res[1].text).toEqual('label2');
        expect(res.length).toBe(2);
      });
    });

    mocks.forEach((mock, index) => {
      it(`should return label values for Loki v${index}`, async () => {
        ds.getVersion = mock.getVersion;
        ds.metadataRequest = mock.metadataRequest;
        const query = 'label_values(label1)';
        const res = await ds.metricFindQuery(query);
        expect(res[0].text).toEqual('value1');
        expect(res[1].text).toEqual('value2');
        expect(res.length).toBe(2);
      });
    });

    mocks.forEach((mock, index) => {
      it(`should return empty array when incorrect query for Loki v${index}`, async () => {
        ds.getVersion = mock.getVersion;
        ds.metadataRequest = mock.metadataRequest;
        const query = 'incorrect_query';
        const res = await ds.metricFindQuery(query);
        expect(res.length).toBe(0);
      });
    });
  });
});

type LimitTestArgs = {
  maxDataPoints?: number;
  maxLines?: number;
  expectedLimit: number;
};
function makeLimitTest(instanceSettings: any, datasourceRequestMock: any, templateSrvMock: any, testResp: any) {
  return ({ maxDataPoints, maxLines, expectedLimit }: LimitTestArgs) => {
    let settings = instanceSettings;
    if (Number.isFinite(maxLines)) {
      const customData = { ...(instanceSettings.jsonData || {}), maxLines: 20 };
      settings = { ...instanceSettings, jsonData: customData };
    }
    const ds = new LokiDatasource(settings, templateSrvMock);
    datasourceRequestMock.mockImplementation(() => Promise.resolve(testResp));

    const options = getQueryOptions<LokiQuery>({ targets: [{ expr: 'foo', refId: 'B', maxLines: maxDataPoints }] });
    if (Number.isFinite(maxDataPoints)) {
      options.maxDataPoints = maxDataPoints;
    } else {
      // By default is 500
      delete options.maxDataPoints;
    }

    ds.query(options);

    expect(datasourceRequestMock.mock.calls.length).toBe(1);
    expect(datasourceRequestMock.mock.calls[0][0].url).toContain(`limit=${expectedLimit}`);
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

function makeMetadataAndVersionsMocks() {
  const mocks = [];
  for (let i = 0; i <= 1; i++) {
    const mock: LokiDatasource = makeMockLokiDatasource({ label1: ['value1', 'value2'], label2: ['value3', 'value4'] });
    mock.getVersion = jest.fn().mockReturnValue(`v${i}`);
    mocks.push(mock);
  }
  return mocks;
}
