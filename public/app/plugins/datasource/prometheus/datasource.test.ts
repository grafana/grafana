import { cloneDeep } from 'lodash';
import { lastValueFrom, of } from 'rxjs';

import {
  AnnotationEvent,
  AnnotationQueryRequest,
  CoreApp,
  DataQueryRequest,
  DataSourceInstanceSettings,
  dateTime,
  rangeUtil,
  TimeRange,
  VariableHide,
} from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

import {
  alignRange,
  extractRuleMappingFromGroups,
  PrometheusDatasource,
  prometheusRegularEscape,
  prometheusSpecialRegexEscape,
} from './datasource';
import PromQlLanguageProvider from './language_provider';
import { PrometheusCacheLevel, PromOptions, PromQuery, PromQueryRequest } from './types';

const fetchMock = jest.fn().mockReturnValue(of(createDefaultPromResponse()));

jest.mock('./metric_find_query');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    fetch: fetchMock,
  }),
  getTemplateSrv: () => templateSrvStub,
}));

const replaceMock = jest.fn().mockImplementation((a: string, ...rest: unknown[]) => a);

const templateSrvStub = {
  replace: replaceMock,
} as unknown as TemplateSrv;

const fromSeconds = 1674500289215;
const toSeconds = 1674500349215;

const mockTimeRangeOld: TimeRange = {
  from: dateTime(1531468681),
  to: dateTime(1531489712),
  raw: {
    from: '1531468681',
    to: '1531489712',
  },
};

const mockTimeRange: TimeRange = {
  from: dateTime(fromSeconds),
  to: dateTime(toSeconds),
  raw: {
    from: fromSeconds.toString(),
    to: toSeconds.toString(),
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PrometheusDatasource', () => {
  let ds: PrometheusDatasource;
  const instanceSettings = {
    url: 'proxied',
    id: 1,
    uid: 'ABCDEF',
    user: 'test',
    password: 'mupp',
    access: 'proxy',
    jsonData: {
      customQueryParameters: '',
      cacheLevel: PrometheusCacheLevel.Low,
    } as Partial<PromOptions>,
  } as unknown as DataSourceInstanceSettings<PromOptions>;

  beforeEach(() => {
    ds = new PrometheusDatasource(instanceSettings, templateSrvStub);
  });

  // Some functions are required by the parent datasource class to provide functionality such as ad-hoc filters, which requires the definition of the getTagKeys, and getTagValues functions
  describe('Datasource contract', () => {
    it('has function called getTagKeys', () => {
      expect(Object.getOwnPropertyNames(Object.getPrototypeOf(ds))).toContain('getTagKeys');
    });
    it('has function called getTagValues', () => {
      expect(Object.getOwnPropertyNames(Object.getPrototypeOf(ds))).toContain('getTagValues');
    });
  });

  describe('Query', () => {
    it('throws if using direct access', async () => {
      const instanceSettings = {
        url: 'proxied',
        directUrl: 'direct',
        user: 'test',
        password: 'mupp',
        access: 'direct',
        jsonData: {
          customQueryParameters: '',
        },
      } as unknown as DataSourceInstanceSettings<PromOptions>;
      const range = { from: time({ seconds: 63 }), to: time({ seconds: 183 }) };
      const directDs = new PrometheusDatasource(instanceSettings, templateSrvStub);

      await expect(
        lastValueFrom(
          directDs.query(
            createDataRequest(
              [
                {
                  expr: '',
                  refId: 'A',
                },
                { expr: '', refId: 'B' },
              ],
              { app: CoreApp.Dashboard }
            )
          )
        )
      ).rejects.toMatchObject({ message: expect.stringMatching('Browser access') });

      // Cannot test because some other tests need "./metric_find_query" to be mocked and that prevents this to be
      // tested. Checked manually that this ends up with throwing
      // await expect(directDs.metricFindQuery('label_names(foo)')).rejects.toBeDefined();

      await expect(
        directDs.annotationQuery({
          range: { ...range, raw: range },
          rangeRaw: range,
          // Should be DataModel but cannot import that here from the main app. Needs to be moved to package first.
          dashboard: {},
          annotation: {
            expr: 'metric',
            name: 'test',
            enable: true,
            iconColor: '',
          },
        })
      ).rejects.toMatchObject({
        message: expect.stringMatching('Browser access'),
      });

      const errorMock = jest.spyOn(console, 'error').mockImplementation(() => {});

      await directDs.getTagKeys({ filters: [] });
      // Language provider currently catches and just logs the error
      expect(errorMock).toHaveBeenCalledTimes(1);

      await expect(directDs.getTagValues({ filters: [], key: 'A' })).rejects.toMatchObject({
        message: expect.stringMatching('Browser access'),
      });
    });
  });

  describe('Datasource metadata requests', () => {
    it('should perform a GET request with the default config', () => {
      ds.metadataRequest('/foo', { bar: 'baz baz', foo: 'foo' });
      expect(fetchMock.mock.calls.length).toBe(1);
      expect(fetchMock.mock.calls[0][0].method).toBe('GET');
      expect(fetchMock.mock.calls[0][0].url).toContain('bar=baz%20baz&foo=foo');
    });
    it('should still perform a GET request with the DS HTTP method set to POST and not POST-friendly endpoint', () => {
      const postSettings = cloneDeep(instanceSettings);
      postSettings.jsonData.httpMethod = 'POST';
      const promDs = new PrometheusDatasource(postSettings, templateSrvStub);
      promDs.metadataRequest('/foo');
      expect(fetchMock.mock.calls.length).toBe(1);
      expect(fetchMock.mock.calls[0][0].method).toBe('GET');
    });
    it('should try to perform a POST request with the DS HTTP method set to POST and POST-friendly endpoint', () => {
      const postSettings = cloneDeep(instanceSettings);
      postSettings.jsonData.httpMethod = 'POST';
      const promDs = new PrometheusDatasource(postSettings, templateSrvStub);
      promDs.metadataRequest('api/v1/series', { bar: 'baz baz', foo: 'foo' });
      expect(fetchMock.mock.calls.length).toBe(1);
      expect(fetchMock.mock.calls[0][0].method).toBe('POST');
      expect(fetchMock.mock.calls[0][0].url).not.toContain('bar=baz%20baz&foo=foo');
      expect(fetchMock.mock.calls[0][0].data).toEqual({ bar: 'baz baz', foo: 'foo' });
    });
  });

  describe('customQueryParams', () => {
    describe('with GET http method', () => {
      const promDs = new PrometheusDatasource(
        { ...instanceSettings, jsonData: { customQueryParameters: 'customQuery=123', httpMethod: 'GET' } },
        templateSrvStub
      );

      it('added to metadata request', () => {
        promDs.metadataRequest('/foo');
        expect(fetchMock.mock.calls.length).toBe(1);
        expect(fetchMock.mock.calls[0][0].url).toBe('/api/datasources/uid/ABCDEF/resources/foo?customQuery=123');
      });
    });

    describe('with POST http method', () => {
      const promDs = new PrometheusDatasource(
        { ...instanceSettings, jsonData: { customQueryParameters: 'customQuery=123', httpMethod: 'POST' } },
        templateSrvStub
      );

      it('added to metadata request with non-POST endpoint', () => {
        promDs.metadataRequest('/foo');
        expect(fetchMock.mock.calls.length).toBe(1);
        expect(fetchMock.mock.calls[0][0].url).toBe('/api/datasources/uid/ABCDEF/resources/foo?customQuery=123');
      });

      it('added to metadata request with POST endpoint', () => {
        promDs.metadataRequest('/api/v1/labels');
        expect(fetchMock.mock.calls.length).toBe(1);
        expect(fetchMock.mock.calls[0][0].url).toBe('/api/datasources/uid/ABCDEF/resources/api/v1/labels');
        expect(fetchMock.mock.calls[0][0].data.customQuery).toBe('123');
      });
    });
  });

  describe('When using adhoc filters', () => {
    const DEFAULT_QUERY_EXPRESSION = 'metric{job="foo"} - metric';
    const target: PromQuery = { expr: DEFAULT_QUERY_EXPRESSION, refId: 'A' };

    it('should not modify expression with no filters', () => {
      const result = ds.createQuery(
        target,
        { interval: '15s', range: getMockTimeRange() } as DataQueryRequest<PromQuery>,
        0,
        0
      );
      expect(result).toMatchObject({ expr: DEFAULT_QUERY_EXPRESSION });
    });

    it('should add filters to expression', () => {
      const filters = [
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
      const result = ds.createQuery(
        target,
        { interval: '15s', range: getMockTimeRange(), filters } as DataQueryRequest<PromQuery>,
        0,
        0
      );
      expect(result).toMatchObject({ expr: 'metric{job="foo", k1="v1", k2!="v2"} - metric{k1="v1", k2!="v2"}' });
    });

    it('should add escaping if needed to regex filter expressions', () => {
      const filters = [
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

      const result = ds.createQuery(
        target,
        { interval: '15s', range: getMockTimeRange(), filters } as DataQueryRequest<PromQuery>,
        0,
        0
      );
      expect(result).toMatchObject({
        expr: `metric{job="foo", k1=~"v.*", k2=~"v\\\\'.*"} - metric{k1=~"v.*", k2=~"v\\\\'.*"}`,
      });
    });
  });

  describe('Test query range snapping', () => {
    it('test default 1 minute quantization', () => {
      const dataSource = new PrometheusDatasource(
        {
          ...instanceSettings,
          jsonData: { ...instanceSettings.jsonData, cacheLevel: PrometheusCacheLevel.Low },
        },
        templateSrvStub as unknown as TemplateSrv
      );
      const quantizedRange = dataSource.getAdjustedInterval(mockTimeRange);
      // For "1 minute" the window contains all the minutes, so a query from 1:11:09 - 1:12:09 becomes 1:11 - 1:13
      expect(parseInt(quantizedRange.end, 10) - parseInt(quantizedRange.start, 10)).toBe(120);
    });

    it('test 10 minute quantization', () => {
      const dataSource = new PrometheusDatasource(
        {
          ...instanceSettings,
          jsonData: { ...instanceSettings.jsonData, cacheLevel: PrometheusCacheLevel.Medium },
        },
        templateSrvStub as unknown as TemplateSrv
      );
      const quantizedRange = dataSource.getAdjustedInterval(mockTimeRange);
      expect(parseInt(quantizedRange.end, 10) - parseInt(quantizedRange.start, 10)).toBe(600);
    });

    it('test 60 minute quantization', () => {
      const dataSource = new PrometheusDatasource(
        {
          ...instanceSettings,
          jsonData: { ...instanceSettings.jsonData, cacheLevel: PrometheusCacheLevel.High },
        },
        templateSrvStub as unknown as TemplateSrv
      );
      const quantizedRange = dataSource.getAdjustedInterval(mockTimeRange);
      expect(parseInt(quantizedRange.end, 10) - parseInt(quantizedRange.start, 10)).toBe(3600);
    });

    it('test quantization turned off', () => {
      const dataSource = new PrometheusDatasource(
        {
          ...instanceSettings,
          jsonData: { ...instanceSettings.jsonData, cacheLevel: PrometheusCacheLevel.None },
        },
        templateSrvStub as unknown as TemplateSrv
      );
      const quantizedRange = dataSource.getAdjustedInterval(mockTimeRange);
      expect(parseInt(quantizedRange.end, 10) - parseInt(quantizedRange.start, 10)).toBe(
        (toSeconds - fromSeconds) / 1000
      );
    });
  });

  describe('alignRange', () => {
    it('does not modify already aligned intervals with perfect step', () => {
      const range = alignRange(0, 3, 3, 0);
      expect(range.start).toEqual(0);
      expect(range.end).toEqual(3);
    });

    it('does modify end-aligned intervals to reflect number of steps possible', () => {
      const range = alignRange(1, 6, 3, 0);
      expect(range.start).toEqual(0);
      expect(range.end).toEqual(6);
    });

    it('does align intervals that are a multiple of steps', () => {
      const range = alignRange(1, 4, 3, 0);
      expect(range.start).toEqual(0);
      expect(range.end).toEqual(3);
    });

    it('does align intervals that are not a multiple of steps', () => {
      const range = alignRange(1, 5, 3, 0);
      expect(range.start).toEqual(0);
      expect(range.end).toEqual(3);
    });

    it('does align intervals with local midnight -UTC offset', () => {
      //week range, location 4+ hours UTC offset, 24h step time
      const range = alignRange(4 * 60 * 60, (7 * 24 + 4) * 60 * 60, 24 * 60 * 60, -4 * 60 * 60); //04:00 UTC, 7 day range
      expect(range.start).toEqual(4 * 60 * 60);
      expect(range.end).toEqual((7 * 24 + 4) * 60 * 60);
    });

    it('does align intervals with local midnight +UTC offset', () => {
      //week range, location 4- hours UTC offset, 24h step time
      const range = alignRange(20 * 60 * 60, (8 * 24 - 4) * 60 * 60, 24 * 60 * 60, 4 * 60 * 60); //20:00 UTC on day1, 7 days later is 20:00 on day8
      expect(range.start).toEqual(20 * 60 * 60);
      expect(range.end).toEqual((8 * 24 - 4) * 60 * 60);
    });
  });

  describe('extractRuleMappingFromGroups()', () => {
    it('returns empty mapping for no rule groups', () => {
      expect(extractRuleMappingFromGroups([])).toEqual({});
    });

    it('returns a mapping for recording rules only', () => {
      const groups = [
        {
          rules: [
            {
              name: 'HighRequestLatency',
              query: 'job:request_latency_seconds:mean5m{job="myjob"} > 0.5',
              type: 'alerting',
            },
            {
              name: 'job:http_inprogress_requests:sum',
              query: 'sum(http_inprogress_requests) by (job)',
              type: 'recording',
            },
          ],
          file: '/rules.yaml',
          interval: 60,
          name: 'example',
        },
      ];
      const mapping = extractRuleMappingFromGroups(groups);
      expect(mapping).toEqual({ 'job:http_inprogress_requests:sum': 'sum(http_inprogress_requests) by (job)' });
    });
  });

  describe('Prometheus regular escaping', () => {
    it('should not escape non-string', () => {
      expect(prometheusRegularEscape(12)).toEqual(12);
    });

    it('should not escape simple string', () => {
      expect(prometheusRegularEscape('cryptodepression')).toEqual('cryptodepression');
    });

    it("should escape '", () => {
      expect(prometheusRegularEscape("looking'glass")).toEqual("looking\\\\'glass");
    });

    it('should escape \\', () => {
      expect(prometheusRegularEscape('looking\\glass')).toEqual('looking\\\\glass');
    });

    it('should escape multiple characters', () => {
      expect(prometheusRegularEscape("'looking'glass'")).toEqual("\\\\'looking\\\\'glass\\\\'");
    });

    it('should escape multiple different characters', () => {
      expect(prometheusRegularEscape("'loo\\king'glass'")).toEqual("\\\\'loo\\\\king\\\\'glass\\\\'");
    });
  });

  describe('Prometheus regexes escaping', () => {
    it('should not escape simple string', () => {
      expect(prometheusSpecialRegexEscape('cryptodepression')).toEqual('cryptodepression');
    });

    it('should escape $^*+?.()|\\', () => {
      expect(prometheusSpecialRegexEscape("looking'glass")).toEqual("looking\\\\'glass");
      expect(prometheusSpecialRegexEscape('looking{glass')).toEqual('looking\\\\{glass');
      expect(prometheusSpecialRegexEscape('looking}glass')).toEqual('looking\\\\}glass');
      expect(prometheusSpecialRegexEscape('looking[glass')).toEqual('looking\\\\[glass');
      expect(prometheusSpecialRegexEscape('looking]glass')).toEqual('looking\\\\]glass');
      expect(prometheusSpecialRegexEscape('looking$glass')).toEqual('looking\\\\$glass');
      expect(prometheusSpecialRegexEscape('looking^glass')).toEqual('looking\\\\^glass');
      expect(prometheusSpecialRegexEscape('looking*glass')).toEqual('looking\\\\*glass');
      expect(prometheusSpecialRegexEscape('looking+glass')).toEqual('looking\\\\+glass');
      expect(prometheusSpecialRegexEscape('looking?glass')).toEqual('looking\\\\?glass');
      expect(prometheusSpecialRegexEscape('looking.glass')).toEqual('looking\\\\.glass');
      expect(prometheusSpecialRegexEscape('looking(glass')).toEqual('looking\\\\(glass');
      expect(prometheusSpecialRegexEscape('looking)glass')).toEqual('looking\\\\)glass');
      expect(prometheusSpecialRegexEscape('looking\\glass')).toEqual('looking\\\\\\\\glass');
      expect(prometheusSpecialRegexEscape('looking|glass')).toEqual('looking\\\\|glass');
    });

    it('should escape multiple special characters', () => {
      expect(prometheusSpecialRegexEscape('+looking$glass?')).toEqual('\\\\+looking\\\\$glass\\\\?');
    });
  });

  describe('When interpolating variables', () => {
    let customVariable: any;
    beforeEach(() => {
      customVariable = {
        id: '',
        global: false,
        multi: false,
        includeAll: false,
        allValue: null,
        query: '',
        options: [],
        current: {},
        name: '',
        type: 'custom',
        label: null,
        hide: VariableHide.dontHide,
        skipUrlSync: false,
        index: -1,
        initLock: null,
      };
    });

    describe('and value is a string', () => {
      it('should only escape single quotes', () => {
        expect(ds.interpolateQueryExpr("abc'$^*{}[]+?.()|", customVariable)).toEqual("abc\\\\'$^*{}[]+?.()|");
      });
    });

    describe('and value is a number', () => {
      it('should return a number', () => {
        expect(ds.interpolateQueryExpr(1000 as any, customVariable)).toEqual(1000);
      });
    });

    describe('and variable allows multi-value', () => {
      beforeEach(() => {
        customVariable.multi = true;
      });

      it('should regex escape values if the value is a string', () => {
        expect(ds.interpolateQueryExpr('looking*glass', customVariable)).toEqual('looking\\\\*glass');
      });

      it('should return pipe separated values if the value is an array of strings', () => {
        expect(ds.interpolateQueryExpr(['a|bc', 'de|f'], customVariable)).toEqual('(a\\\\|bc|de\\\\|f)');
      });

      it('should return 1 regex escaped value if there is just 1 value in an array of strings', () => {
        expect(ds.interpolateQueryExpr(['looking*glass'], customVariable)).toEqual('looking\\\\*glass');
      });
    });

    describe('and variable allows all', () => {
      beforeEach(() => {
        customVariable.includeAll = true;
      });

      it('should regex escape values if the array is a string', () => {
        expect(ds.interpolateQueryExpr('looking*glass', customVariable)).toEqual('looking\\\\*glass');
      });

      it('should return pipe separated values if the value is an array of strings', () => {
        expect(ds.interpolateQueryExpr(['a|bc', 'de|f'], customVariable)).toEqual('(a\\\\|bc|de\\\\|f)');
      });

      it('should return 1 regex escaped value if there is just 1 value in an array of strings', () => {
        expect(ds.interpolateQueryExpr(['looking*glass'], customVariable)).toEqual('looking\\\\*glass');
      });
    });
  });

  describe('interpolateVariablesInQueries', () => {
    it('should call replace function 2 times', () => {
      const query: PromQuery = {
        expr: 'test{job="testjob"}',
        format: 'time_series',
        interval: '$Interval',
        refId: 'A',
      };
      const interval = '10m';
      replaceMock.mockReturnValue(interval);

      const queries = ds.interpolateVariablesInQueries([query], { Interval: { text: interval, value: interval } });
      expect(templateSrvStub.replace).toBeCalledTimes(2);
      expect(queries[0].interval).toBe(interval);
    });

    it('should call enhanceExprWithAdHocFilters', () => {
      ds.enhanceExprWithAdHocFilters = jest.fn();
      const queries = [
        {
          refId: 'A',
          expr: 'rate({bar="baz", job="foo"} [5m]',
        },
      ];
      ds.interpolateVariablesInQueries(queries, {});
      expect(ds.enhanceExprWithAdHocFilters).toHaveBeenCalled();
    });
  });

  describe('applyTemplateVariables', () => {
    afterAll(() => {
      replaceMock.mockImplementation((a: string, ...rest: unknown[]) => a);
    });

    it('should call replace function for legendFormat', () => {
      const query = {
        expr: 'test{job="bar"}',
        legendFormat: '$legend',
        refId: 'A',
      };
      const legend = 'baz';
      replaceMock.mockReturnValue(legend);

      const interpolatedQuery = ds.applyTemplateVariables(query, { legend: { text: legend, value: legend } });
      expect(interpolatedQuery.legendFormat).toBe(legend);
    });

    it('should call replace function for interval', () => {
      const query = {
        expr: 'test{job="bar"}',
        interval: '$step',
        refId: 'A',
      };
      const step = '5s';
      replaceMock.mockReturnValue(step);

      const interpolatedQuery = ds.applyTemplateVariables(query, { step: { text: step, value: step } });
      expect(interpolatedQuery.interval).toBe(step);
    });

    it('should call replace function for expr', () => {
      const query = {
        expr: 'test{job="$job"}',
        refId: 'A',
      };
      const job = 'bar';
      replaceMock.mockReturnValue(job);

      const interpolatedQuery = ds.applyTemplateVariables(query, { job: { text: job, value: job } });
      expect(interpolatedQuery.expr).toBe(job);
    });

    it('should add ad-hoc filters to expr', () => {
      replaceMock.mockImplementation((a: string) => a);
      const filters = [
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

      const query = {
        expr: 'test{job="bar"}',
        refId: 'A',
      };

      const result = ds.applyTemplateVariables(query, {}, filters);
      expect(result).toMatchObject({ expr: 'test{job="bar", k1="v1", k2!="v2"}' });
    });

    it('should add ad-hoc filters only to expr', () => {
      replaceMock.mockImplementation((a: string) => a?.replace('$A', '99') ?? a);
      const filters = [
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

      const query = {
        expr: 'test{job="bar"} > $A',
        refId: 'A',
      };

      const result = ds.applyTemplateVariables(query, {}, filters);
      expect(result).toMatchObject({ expr: 'test{job="bar", k1="v1", k2!="v2"} > 99' });
    });

    it('should add ad-hoc filters only to expr and expression has template variable as label value??', () => {
      const searchPattern = /\$A/g;
      replaceMock.mockImplementation((a: string) => a?.replace(searchPattern, '99') ?? a);
      const filters = [
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

      const query = {
        expr: 'test{job="$A"} > $A',
        refId: 'A',
      };

      const result = ds.applyTemplateVariables(query, {}, filters);
      expect(result).toMatchObject({ expr: 'test{job="99", k1="v1", k2!="v2"} > 99' });
    });
  });

  describe('metricFindQuery', () => {
    beforeEach(() => {
      const prometheusDatasource = new PrometheusDatasource(
        { ...instanceSettings, jsonData: { ...instanceSettings.jsonData, cacheLevel: PrometheusCacheLevel.None } },
        templateSrvStub
      );
      const query = 'query_result(topk(5,rate(http_request_duration_microseconds_count[$__interval])))';
      prometheusDatasource.metricFindQuery(query, { range: mockTimeRangeOld });
    });

    it('should call templateSrv.replace with scopedVars', () => {
      expect(replaceMock.mock.calls[0][1]).toBeDefined();
    });

    it('should have the correct range and range_ms', () => {
      const range = replaceMock.mock.calls[0][1].__range;
      const rangeMs = replaceMock.mock.calls[0][1].__range_ms;
      const rangeS = replaceMock.mock.calls[0][1].__range_s;
      expect(range).toEqual({ text: '21s', value: '21s' });
      expect(rangeMs).toEqual({ text: 21031, value: 21031 });
      expect(rangeS).toEqual({ text: 21, value: 21 });
    });

    it('should pass the default interval value', () => {
      const interval = replaceMock.mock.calls[0][1].__interval;
      const intervalMs = replaceMock.mock.calls[0][1].__interval_ms;
      expect(interval).toEqual({ text: '15s', value: '15s' });
      expect(intervalMs).toEqual({ text: 15000, value: 15000 });
    });
  });
});

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const time = ({ hours = 0, seconds = 0, minutes = 0 }) => dateTime(hours * HOUR + minutes * MINUTE + seconds * SECOND);

describe('PrometheusDatasource2', () => {
  const instanceSettings = {
    url: 'proxied',
    id: 1,
    uid: 'ABCDEF',
    user: 'test',
    password: 'mupp',
    jsonData: { httpMethod: 'GET', cacheLevel: PrometheusCacheLevel.None },
  } as unknown as DataSourceInstanceSettings<PromOptions>;

  let ds: PrometheusDatasource;
  beforeEach(() => {
    ds = new PrometheusDatasource(instanceSettings, templateSrvStub);
  });

  describe('annotationQuery', () => {
    let results: AnnotationEvent[];
    const options = {
      annotation: {
        expr: 'ALERTS{alertstate="firing"}',
        tagKeys: 'job',
        titleFormat: '{{alertname}}',
        textFormat: '{{instance}}',
      },
      range: {
        from: time({ seconds: 63 }),
        to: time({ seconds: 123 }),
      },
    } as unknown as AnnotationQueryRequest<PromQuery>;

    const response = createAnnotationResponse();
    const emptyResponse = createEmptyAnnotationResponse();

    describe('handle result with empty fields', () => {
      it('should return empty results', async () => {
        fetchMock.mockImplementation(() => of(emptyResponse));

        await ds.annotationQuery(options).then((data) => {
          results = data;
        });

        expect(results.length).toBe(0);
      });
    });

    describe('when time series query is cancelled', () => {
      it('should return empty results', async () => {
        fetchMock.mockImplementation(() => of({ cancelled: true }));

        await ds.annotationQuery(options).then((data) => {
          results = data;
        });

        expect(results).toEqual([]);
      });
    });

    describe('not use useValueForTime', () => {
      beforeEach(async () => {
        options.annotation.useValueForTime = false;
        fetchMock.mockImplementation(() => of(response));

        await ds.annotationQuery(options).then((data) => {
          results = data;
        });
      });

      it('should return annotation list', () => {
        expect(results.length).toBe(1);
        expect(results[0].tags).toContain('testjob');
        expect(results[0].title).toBe('InstanceDown');
        expect(results[0].text).toBe('testinstance');
        expect(results[0].time).toBe(123);
      });
    });

    describe('use useValueForTime', () => {
      beforeEach(async () => {
        options.annotation.useValueForTime = true;
        fetchMock.mockImplementation(() => of(response));

        await ds.annotationQuery(options).then((data) => {
          results = data;
        });
      });

      it('should return annotation list', () => {
        expect(results[0].time).toEqual(456);
      });
    });

    describe('step parameter', () => {
      beforeEach(() => {
        fetchMock.mockImplementation(() => of(response));
      });

      it('should use default step for short range if no interval is given', () => {
        const query = {
          ...options,
          range: {
            from: time({ seconds: 63 }),
            to: time({ seconds: 123 }),
          },
        } as AnnotationQueryRequest<PromQuery>;
        ds.annotationQuery(query);
        const req = fetchMock.mock.calls[0][0];
        expect(req.data.queries[0].interval).toBe('60s');
      });

      it('should use default step for short range when annotation step is empty string', () => {
        const query = {
          ...options,
          annotation: {
            ...options.annotation,
            step: '',
          },
          range: {
            from: time({ seconds: 63 }),
            to: time({ seconds: 123 }),
          },
        } as unknown as AnnotationQueryRequest<PromQuery>;
        ds.annotationQuery(query);
        const req = fetchMock.mock.calls[0][0];
        expect(req.data.queries[0].interval).toBe('60s');
      });

      it('should use custom step for short range', () => {
        const annotation = {
          ...options.annotation,
          step: '10s',
        };
        const query = {
          ...options,
          annotation,
          range: {
            from: time({ seconds: 63 }),
            to: time({ seconds: 123 }),
          },
        } as unknown as AnnotationQueryRequest<PromQuery>;
        ds.annotationQuery(query);
        const req = fetchMock.mock.calls[0][0];
        expect(req.data.queries[0].interval).toBe('10s');
      });
    });

    describe('region annotations for sectors', () => {
      const options: any = {
        annotation: {
          expr: 'ALERTS{alertstate="firing"}',
          tagKeys: 'job',
          titleFormat: '{{alertname}}',
          textFormat: '{{instance}}',
        },
        range: {
          from: time({ seconds: 63 }),
          to: time({ seconds: 900 }),
        },
      };

      async function runAnnotationQuery(data: number[][]) {
        let response = createAnnotationResponse();
        response.data.results['X'].frames[0].data.values = data;

        options.annotation.useValueForTime = false;
        fetchMock.mockImplementation(() => of(response));

        return ds.annotationQuery(options);
      }

      it('should handle gaps and inactive values', async () => {
        const results = await runAnnotationQuery([
          [2 * 60000, 3 * 60000, 5 * 60000, 6 * 60000, 7 * 60000, 8 * 60000, 9 * 60000],
          [1, 1, 1, 1, 1, 0, 1],
        ]);
        expect(results.map((result) => [result.time, result.timeEnd])).toEqual([
          [120000, 180000],
          [300000, 420000],
          [540000, 540000],
        ]);
      });

      it('should handle single region', async () => {
        const results = await runAnnotationQuery([
          [2 * 60000, 3 * 60000],
          [1, 1],
        ]);
        expect(results.map((result) => [result.time, result.timeEnd])).toEqual([[120000, 180000]]);
      });

      it('should handle 0 active regions', async () => {
        const results = await runAnnotationQuery([
          [2 * 60000, 3 * 60000, 5 * 60000],
          [0, 0, 0],
        ]);
        expect(results.length).toBe(0);
      });

      it('should handle single active value', async () => {
        const results = await runAnnotationQuery([[2 * 60000], [1]]);
        expect(results.map((result) => [result.time, result.timeEnd])).toEqual([[120000, 120000]]);
      });
    });

    describe('with template variables', () => {
      afterAll(() => {
        replaceMock.mockImplementation((a: string, ...rest: unknown[]) => a);
      });

      it('should interpolate variables in query expr', () => {
        const query = {
          ...options,
          annotation: {
            ...options.annotation,
            expr: '$variable',
          },
          range: {
            from: time({ seconds: 1 }),
            to: time({ seconds: 2 }),
          },
        } as unknown as AnnotationQueryRequest<PromQuery>;
        const interpolated = 'interpolated_expr';
        replaceMock.mockReturnValue(interpolated);
        ds.annotationQuery(query);
        const req = fetchMock.mock.calls[0][0];
        expect(req.data.queries[0].expr).toBe(interpolated);
      });
    });
  });

  describe('The __rate_interval variable', () => {
    const target = { expr: 'rate(process_cpu_seconds_total[$__rate_interval])', refId: 'A' };

    beforeEach(() => {
      replaceMock.mockClear();
    });

    it('should be 4 times the scrape interval if interval + scrape interval is lower', () => {
      ds.createQuery(target, { interval: '15s', range: getMockTimeRange() } as DataQueryRequest<PromQuery>, 0, 300);
      expect(replaceMock.mock.calls[1][1]['__rate_interval'].value).toBe('60s');
    });
    it('should be interval + scrape interval if 4 times the scrape interval is lower', () => {
      ds.createQuery(target, { interval: '5m', range: getMockTimeRange() } as DataQueryRequest<PromQuery>, 0, 10080);
      expect(replaceMock.mock.calls[1][1]['__rate_interval'].value).toBe('315s');
    });
    it('should fall back to a scrape interval of 15s if min step is set to 0, resulting in 4*15s = 60s', () => {
      ds.createQuery(
        { ...target, interval: '' },
        { interval: '15s', range: getMockTimeRange() } as DataQueryRequest<PromQuery>,
        0,
        300
      );
      expect(replaceMock.mock.calls[1][1]['__rate_interval'].value).toBe('60s');
    });
    it('should be 4 times the scrape interval if min step set to 1m and interval is 15s', () => {
      // For a 5m graph, $__interval is 15s
      ds.createQuery(
        { ...target, interval: '1m' },
        { interval: '15s', range: getMockTimeRange() } as DataQueryRequest<PromQuery>,
        0,
        300
      );
      expect(replaceMock.mock.calls[2][1]['__rate_interval'].value).toBe('240s');
    });
    it('should be interval + scrape interval if min step set to 1m and interval is 5m', () => {
      // For a 7d graph, $__interval is 5m
      ds.createQuery(
        { ...target, interval: '1m' },
        { interval: '5m', range: getMockTimeRange() } as DataQueryRequest<PromQuery>,
        0,
        10080
      );
      expect(replaceMock.mock.calls[2][1]['__rate_interval'].value).toBe('360s');
    });
    it('should be interval + scrape interval if resolution is set to 1/2 and interval is 10m', () => {
      // For a 7d graph, $__interval is 10m
      ds.createQuery(
        { ...target, intervalFactor: 2 },
        { interval: '10m', range: getMockTimeRange() } as DataQueryRequest<PromQuery>,
        0,
        10080
      );
      expect(replaceMock.mock.calls[1][1]['__rate_interval'].value).toBe('1215s');
    });
    it('should be 4 times the scrape interval if resolution is set to 1/2 and interval is 15s', () => {
      // For a 5m graph, $__interval is 15s
      ds.createQuery(
        { ...target, intervalFactor: 2 },
        { interval: '15s', range: getMockTimeRange() } as DataQueryRequest<PromQuery>,
        0,
        300
      );
      expect(replaceMock.mock.calls[1][1]['__rate_interval'].value).toBe('60s');
    });
    it('should interpolate min step if set', () => {
      replaceMock.mockImplementation((_: string) => '15s');
      ds.createQuery(
        { ...target, interval: '$int' },
        { interval: '15s', range: getMockTimeRange() } as DataQueryRequest<PromQuery>,
        0,
        300
      );
      expect(replaceMock.mock.calls).toHaveLength(3);
      replaceMock.mockImplementation((str) => str);
    });
  });

  it('should give back 1 exemplar target when multiple queries with exemplar enabled and same metric', () => {
    const targetA: PromQuery = {
      refId: 'A',
      expr: 'histogram_quantile(0.95, sum(rate(tns_request_duration_seconds_bucket[5m])) by (le))',
      exemplar: true,
    };
    const targetB: PromQuery = {
      refId: 'B',
      expr: 'histogram_quantile(0.5, sum(rate(tns_request_duration_seconds_bucket[5m])) by (le))',
      exemplar: true,
    };

    ds.languageProvider = {
      histogramMetrics: ['tns_request_duration_seconds_bucket'],
    } as PromQlLanguageProvider;

    const request = {
      targets: [targetA, targetB],
      interval: '1s',
      panelId: '',
    } as unknown as DataQueryRequest<PromQuery>;

    const Aexemplars = ds.shouldRunExemplarQuery(targetA, request);
    const BExpemplars = ds.shouldRunExemplarQuery(targetB, request);

    expect(Aexemplars).toBe(true);
    expect(BExpemplars).toBe(false);
  });
});

describe('When querying prometheus via check headers X-Dashboard-Id X-Panel-Id and X-Dashboard-UID', () => {
  const options = { panelId: 2, dashboardUID: 'WFlOM-jM1' } as DataQueryRequest<PromQuery>;
  const httpOptions = {
    headers: {} as { [key: string]: number | undefined },
  } as PromQueryRequest;
  const instanceSettings = {
    url: 'proxied',
    directUrl: 'direct',
    user: 'test',
    password: 'mupp',
    access: 'proxy',
    jsonData: { httpMethod: 'POST' },
  } as unknown as DataSourceInstanceSettings<PromOptions>;

  let ds: PrometheusDatasource;
  beforeEach(() => {
    ds = new PrometheusDatasource(instanceSettings, templateSrvStub as unknown as TemplateSrv);
  });

  it('with proxy access tracing headers should be added', () => {
    ds._addTracingHeaders(httpOptions, options);
    expect(httpOptions.headers['X-Panel-Id']).toBe(options.panelId);
    expect(httpOptions.headers['X-Dashboard-UID']).toBe(options.dashboardUID);
  });

  it('with direct access tracing headers should not be added', () => {
    const instanceSettings = {
      url: 'proxied',
      directUrl: 'direct',
      user: 'test',
      password: 'mupp',
      jsonData: { httpMethod: 'POST' },
    } as unknown as DataSourceInstanceSettings<PromOptions>;

    const mockDs = new PrometheusDatasource({ ...instanceSettings, url: 'http://127.0.0.1:8000' }, templateSrvStub);
    mockDs._addTracingHeaders(httpOptions, options);
    expect(httpOptions.headers['X-Dashboard-Id']).toBe(undefined);
    expect(httpOptions.headers['X-Panel-Id']).toBe(undefined);
    expect(httpOptions.headers['X-Dashboard-UID']).toBe(undefined);
  });
});

describe('modifyQuery', () => {
  describe('when called with ADD_FILTER', () => {
    describe('and query has no labels', () => {
      it('then the correct label should be added', () => {
        const query: PromQuery = { refId: 'A', expr: 'go_goroutines' };
        const action = { options: { key: 'cluster', value: 'us-cluster' }, type: 'ADD_FILTER' };
        const instanceSettings = { jsonData: {} } as unknown as DataSourceInstanceSettings<PromOptions>;
        const ds = new PrometheusDatasource(instanceSettings, templateSrvStub);

        const result = ds.modifyQuery(query, action);

        expect(result.refId).toEqual('A');
        expect(result.expr).toEqual('go_goroutines{cluster="us-cluster"}');
      });
    });

    describe('and query has labels', () => {
      it('then the correct label should be added', () => {
        const query: PromQuery = { refId: 'A', expr: 'go_goroutines{cluster="us-cluster"}' };
        const action = { options: { key: 'pod', value: 'pod-123' }, type: 'ADD_FILTER' };
        const instanceSettings = { jsonData: {} } as unknown as DataSourceInstanceSettings<PromOptions>;
        const ds = new PrometheusDatasource(instanceSettings, templateSrvStub);

        const result = ds.modifyQuery(query, action);

        expect(result.refId).toEqual('A');
        expect(result.expr).toEqual('go_goroutines{cluster="us-cluster", pod="pod-123"}');
      });
    });
  });

  describe('when called with ADD_FILTER_OUT', () => {
    describe('and query has no labels', () => {
      it('then the correct label should be added', () => {
        const query: PromQuery = { refId: 'A', expr: 'go_goroutines' };
        const action = { options: { key: 'cluster', value: 'us-cluster' }, type: 'ADD_FILTER_OUT' };
        const instanceSettings = { jsonData: {} } as unknown as DataSourceInstanceSettings<PromOptions>;
        const ds = new PrometheusDatasource(instanceSettings, templateSrvStub);

        const result = ds.modifyQuery(query, action);

        expect(result.refId).toEqual('A');
        expect(result.expr).toEqual('go_goroutines{cluster!="us-cluster"}');
      });
    });

    describe('and query has labels', () => {
      it('then the correct label should be added', () => {
        const query: PromQuery = { refId: 'A', expr: 'go_goroutines{cluster="us-cluster"}' };
        const action = { options: { key: 'pod', value: 'pod-123' }, type: 'ADD_FILTER_OUT' };
        const instanceSettings = { jsonData: {} } as unknown as DataSourceInstanceSettings<PromOptions>;
        const ds = new PrometheusDatasource(instanceSettings, templateSrvStub);

        const result = ds.modifyQuery(query, action);

        expect(result.refId).toEqual('A');
        expect(result.expr).toEqual('go_goroutines{cluster="us-cluster", pod!="pod-123"}');
      });
    });
  });
});

function createDataRequest(targets: PromQuery[], overrides?: Partial<DataQueryRequest>): DataQueryRequest<PromQuery> {
  const defaults: DataQueryRequest<PromQuery> = {
    intervalMs: 15000,
    requestId: 'createDataRequest',
    startTime: 0,
    timezone: 'browser',
    app: CoreApp.Dashboard,
    targets: targets.map((t, i) => ({
      instant: false,
      start: dateTime().subtract(5, 'minutes'),
      end: dateTime(),
      ...t,
    })),
    range: {
      from: dateTime(),
      to: dateTime(),
      raw: {
        from: '',
        to: '',
      },
    },
    interval: '15s',
    scopedVars: {},
  };

  return Object.assign(defaults, overrides || {}) as DataQueryRequest<PromQuery>;
}

function createDefaultPromResponse() {
  return {
    data: {
      data: {
        result: [
          {
            metric: {
              __name__: 'test_metric',
            },
            values: [[1568369640, 1]],
          },
        ],
        resultType: 'matrix',
      },
    },
  };
}

function createAnnotationResponse() {
  const response = {
    data: {
      results: {
        X: {
          frames: [
            {
              schema: {
                name: 'bar',
                refId: 'X',
                fields: [
                  {
                    name: 'Time',
                    type: 'time',
                    typeInfo: {
                      frame: 'time.Time',
                    },
                  },
                  {
                    name: 'Value',
                    type: 'number',
                    typeInfo: {
                      frame: 'float64',
                    },
                    labels: {
                      __name__: 'ALERTS',
                      alertname: 'InstanceDown',
                      alertstate: 'firing',
                      instance: 'testinstance',
                      job: 'testjob',
                    },
                  },
                ],
              },
              data: {
                values: [[123], [456]],
              },
            },
          ],
        },
      },
    },
  };

  return { ...response };
}

function createEmptyAnnotationResponse() {
  const response = {
    data: {
      results: {
        X: {
          frames: [
            {
              schema: {
                name: 'bar',
                refId: 'X',
                fields: [],
              },
              data: {
                values: [],
              },
            },
          ],
        },
      },
    },
  };

  return { ...response };
}

function getMockTimeRange(range = '6h'): TimeRange {
  return rangeUtil.convertRawToRange({
    from: `now-${range}`,
    to: 'now',
  });
}
