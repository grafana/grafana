import { of, Subject } from 'rxjs';
import { first, last, take } from 'rxjs/operators';
import { omit } from 'lodash';
import { AnnotationQueryRequest, DataFrame, DataQueryResponse, dateTime, FieldCache, TimeRange } from '@grafana/data';
import { BackendSrvRequest, FetchResponse } from '@grafana/runtime';

import LokiDatasource from './datasource';
import { LokiQuery, LokiResponse, LokiResultType } from './types';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { CustomVariableModel } from '../../../features/variables/types';
import { initialCustomVariableModelState } from '../../../features/variables/custom/reducer';
import { observableTester } from '../../../../test/helpers/observableTester';
import { expect } from '../../../../test/lib/common';
import { makeMockLokiDatasource } from './mocks';

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

describe('LokiDatasource', () => {
  let fetchStream: Subject<FetchResponse>;
  const fetchMock = jest.spyOn(backendSrv, 'fetch');

  const testResponse: FetchResponse<LokiResponse> = {
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

  beforeEach(() => {
    jest.clearAllMocks();
    fetchStream = new Subject<FetchResponse>();
    fetchMock.mockImplementation(() => fetchStream.asObservable());
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

      const req = ds.createRangeQuery(target, options as any);
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

      const req = ds.createRangeQuery(target, options as any);
      expect(req.start).toBeDefined();
      expect(req.end).toBeDefined();
      expect(adjustIntervalSpy).toHaveBeenCalledWith(2000, expect.anything());
    });
  });

  describe('when querying with limits', () => {
    const runLimitTest = ({ maxDataPoints, maxLines, expectedLimit, done }: any) => {
      let settings: any = {
        url: 'myloggingurl',
      };

      if (Number.isFinite(maxLines!)) {
        const customData = { ...(settings.jsonData || {}), maxLines: 20 };
        settings = { ...settings, jsonData: customData };
      }

      const templateSrvMock = ({
        getAdhocFilters: (): any[] => [],
        replace: (a: string) => a,
      } as unknown) as TemplateSrv;

      const ds = new LokiDatasource(settings, templateSrvMock, timeSrvStub as any);

      const options = getQueryOptions<LokiQuery>({ targets: [{ expr: 'foo', refId: 'B', maxLines: maxDataPoints }] });

      if (Number.isFinite(maxDataPoints!)) {
        options.maxDataPoints = maxDataPoints;
      } else {
        // By default is 500
        delete options.maxDataPoints;
      }

      observableTester().subscribeAndExpectOnComplete<DataQueryResponse>({
        observable: ds.query(options).pipe(take(1)),
        expect: () => {
          expect(fetchMock.mock.calls.length).toBe(2);
          expect(fetchMock.mock.calls[0][0].url).toContain(`limit=${expectedLimit}`);
        },
        done,
      });

      fetchStream.next(testResponse);
    };

    it('should use default max lines when no limit given', done => {
      runLimitTest({
        expectedLimit: 1000,
        done,
      });
    });

    it('should use custom max lines if limit is set', done => {
      runLimitTest({
        maxLines: 20,
        expectedLimit: 20,
        done,
      });
    });

    it('should use custom maxDataPoints if set in request', () => {
      runLimitTest({
        maxDataPoints: 500,
        expectedLimit: 500,
      });
    });

    it('should use datasource maxLimit if maxDataPoints is higher', () => {
      runLimitTest({
        maxLines: 20,
        maxDataPoints: 500,
        expectedLimit: 20,
      });
    });
  });

  describe('when querying', () => {
    it('should run range and instant query', done => {
      const ds = createLokiDSForTests();
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{job="grafana"}', refId: 'B' }],
      });

      ds.runInstantQuery = jest.fn(() => of({ data: [] }));
      ds.runRangeQuery = jest.fn(() => of({ data: [] }));

      observableTester().subscribeAndExpectOnComplete<DataQueryResponse>({
        observable: ds.query(options),
        expect: () => {
          expect(ds.runInstantQuery).toBeCalled();
          expect(ds.runRangeQuery).toBeCalled();
        },
        done,
      });
    });

    it('should return series data', done => {
      const ds = createLokiDSForTests();
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{job="grafana"} |= "foo"', refId: 'B' }],
      });

      observableTester().subscribeAndExpectOnNext<DataQueryResponse>({
        observable: ds.query(options).pipe(first()), // first result always comes from runInstantQuery
        expect: res => {
          expect(res).toEqual({
            data: [],
            key: 'B_instant',
          });
        },
        done,
      });

      observableTester().subscribeAndExpectOnNext<DataQueryResponse>({
        observable: ds.query(options).pipe(last()), // last result always comes from runRangeQuery
        expect: res => {
          const dataFrame = res.data[0] as DataFrame;
          const fieldCache = new FieldCache(dataFrame);
          expect(fieldCache.getFieldByName('line')?.values.get(0)).toBe('hello');
          expect(dataFrame.meta?.limit).toBe(20);
          expect(dataFrame.meta?.searchWords).toEqual(['foo']);
        },
        done,
      });

      fetchStream.next(testResponse);
      fetchStream.next(omit(testResponse, 'data.status'));
    });

    it('should return custom error message when Loki returns escaping error', done => {
      const ds = createLokiDSForTests();
      const options = getQueryOptions<LokiQuery>({
        targets: [{ expr: '{job="gra\\fana"}', refId: 'B' }],
      });

      observableTester().subscribeAndExpectOnError<DataQueryResponse>({
        observable: ds.query(options),
        expect: err => {
          expect(err.data.message).toBe(
            'Error: parse error at line 1, col 6: invalid char escape. Make sure that all special characters are escaped with \\. For more information on escaping of special characters visit LogQL documentation at https://github.com/grafana/loki/blob/master/docs/logql.md.'
          );
        },
        done,
      });

      fetchStream.error({
        data: {
          message: 'parse error at line 1, col 6: invalid char escape',
        },
        status: 400,
        statusText: 'Bad Request',
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
    const getTestContext = () => {
      const ds = createLokiDSForTests({} as TemplateSrv);
      const promise = ds.testDatasource();

      return { promise };
    };

    describe('and call succeeds', () => {
      it('should return successfully', async () => {
        const { promise } = getTestContext();

        fetchStream.next(({
          status: 200,
          data: {
            values: ['avalue'],
          },
        } as unknown) as FetchResponse);

        fetchStream.complete();

        const result = await promise;

        expect(result.status).toBe('success');
      });
    });

    describe('and call fails with 401 error', () => {
      it('should return error status and a detailed error message', async () => {
        const { promise } = getTestContext();

        fetchStream.error({
          statusText: 'Unauthorized',
          status: 401,
          data: {
            message: 'Unauthorized',
          },
        });

        const result = await promise;

        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Unauthorized. 401. Unauthorized');
      });
    });

    describe('and call fails with 404 error', () => {
      it('should return error status and a detailed error message', async () => {
        const { promise } = getTestContext();

        fetchStream.error({
          statusText: 'Not found',
          status: 404,
          data: {
            message: '404 page not found',
          },
        });

        const result = await promise;

        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Not found. 404. 404 page not found');
      });
    });

    describe('and call fails with 502 error', () => {
      it('should return error status and a detailed error message', async () => {
        const { promise } = getTestContext();

        fetchStream.error({
          statusText: 'Bad Gateway',
          status: 502,
          data: '',
        });

        const result = await promise;

        expect(result.status).toEqual('error');
        expect(result.message).toBe('Loki: Bad Gateway. 502');
      });
    });
  });

  describe('when creating a range query', () => {
    // Loki v1 API has an issue with float step parameters, can be removed when API is fixed
    it('should produce an integer step parameter', () => {
      const ds = createLokiDSForTests();
      const query: LokiQuery = { expr: 'foo', refId: 'bar' };
      const range: TimeRange = {
        from: dateTime(0),
        to: dateTime(1e9 + 1),
        raw: { from: '0', to: '1000000001' },
      };

      // Odd timerange/interval combination that would lead to a float step
      const options = { range, intervalMs: 2000 };

      expect(Number.isInteger(ds.createRangeQuery(query, options as any).step!)).toBeTruthy();
    });
  });

  describe('when calling annotationQuery', () => {
    const getTestContext = () => {
      const query = makeAnnotationQueryRequest();
      const ds = createLokiDSForTests();
      const promise = ds.annotationQuery(query);

      return { promise };
    };

    it('should transform the loki data to annotation response', async () => {
      const { promise } = getTestContext();
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
                  label2: 'value2',
                },
                values: [['1549024057498000000', 'hello 2']],
              },
            ],
          },
          status: 'success',
        },
      } as unknown) as FetchResponse;

      fetchStream.next(response);
      fetchStream.complete();

      const res = await promise;

      expect(res.length).toBe(2);
      expect(res[0].text).toBe('hello');
      expect(res[0].tags).toEqual(['value']);

      expect(res[1].text).toBe('hello 2');
      expect(res[1].tags).toEqual(['value2']);
    });
  });

  describe('metricFindQuery', () => {
    const getTestContext = (mock: LokiDatasource) => {
      const ds = createLokiDSForTests();
      ds.getVersion = mock.getVersion;
      ds.metadataRequest = mock.metadataRequest;

      return { ds };
    };

    const mocks = makeMetadataAndVersionsMocks();

    mocks.forEach((mock, index) => {
      it(`should return label names for Loki v${index}`, async () => {
        const { ds } = getTestContext(mock);

        const res = await ds.metricFindQuery('label_names()');

        expect(res).toEqual([{ text: 'label1' }, { text: 'label2' }]);
      });
    });

    mocks.forEach((mock, index) => {
      it(`should return label values for Loki v${index}`, async () => {
        const { ds } = getTestContext(mock);

        const res = await ds.metricFindQuery('label_values(label1)');

        expect(res).toEqual([{ text: 'value1' }, { text: 'value2' }]);
      });
    });

    mocks.forEach((mock, index) => {
      it(`should return empty array when incorrect query for Loki v${index}`, async () => {
        const { ds } = getTestContext(mock);

        const res = await ds.metricFindQuery('incorrect_query');

        expect(res).toEqual([]);
      });
    });

    mocks.forEach((mock, index) => {
      it(`should return label names according to provided rangefor Loki v${index}`, async () => {
        const { ds } = getTestContext(mock);

        const res = await ds.metricFindQuery('label_names()', { range: { from: new Date(2), to: new Date(3) } });

        expect(res).toEqual([{ text: 'label1' }]);
      });
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
