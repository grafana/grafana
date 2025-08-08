// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/datasource.test.ts
import { cloneDeep } from 'lodash';
import { lastValueFrom, of } from 'rxjs';

import {
  AdHocVariableFilter,
  CoreApp,
  CustomVariableModel,
  DataQueryRequest,
  DataSourceInstanceSettings,
  dateTime,
  LoadingState,
  ScopeSpecFilter,
  TimeRange,
  VariableHide,
} from '@grafana/data';
import { config, getBackendSrv, setBackendSrv, TemplateSrv } from '@grafana/runtime';

import { extractResourceMatcher, extractRuleMappingFromGroups, PrometheusDatasource } from './datasource';
import { prometheusRegularEscape, prometheusSpecialRegexEscape } from './escaping';
import { PrometheusLanguageProviderInterface } from './language_provider';
import { CacheRequestInfo } from './querycache/QueryCache';
import {
  createDataRequest,
  createDefaultPromResponse,
  fetchMockCalledWith,
  getMockTimeRange,
} from './test/mocks/datasource';
import {
  PromApplication,
  PrometheusCacheLevel,
  PromOptions,
  PromQuery,
  PromQueryRequest,
  RawRecordingRules,
} from './types';

const fetchMock = jest.fn().mockReturnValue(of(createDefaultPromResponse()));

jest.mock('./metric_find_query');
const origBackendSrv = getBackendSrv();
setBackendSrv({
  ...origBackendSrv,
  fetch: fetchMock,
});

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
    access: 'proxy',
    user: 'test',
    password: 'mupp',
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
          prometheusVersion: '2.20.0',
          prometheusType: PromApplication.Prometheus,
        },
      } as unknown as DataSourceInstanceSettings<PromOptions>;
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

    describe('with prometheusSpecialCharsInLabelValues disabled', () => {
      beforeAll(() => {
        config.featureToggles.prometheusSpecialCharsInLabelValues = false;
      });

      it('should not modify expression with no filters', async () => {
        ds.query({
          interval: '15s',
          range: getMockTimeRange(),
          targets: [target],
        } as DataQueryRequest<PromQuery>);
        const [result] = fetchMockCalledWith(fetchMock);
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
        ds.query({
          interval: '15s',
          range: getMockTimeRange(),
          filters,
          targets: [target],
        } as DataQueryRequest<PromQuery>);
        const [result] = fetchMockCalledWith(fetchMock);
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
        ds.query({
          interval: '15s',
          range: getMockTimeRange(),
          filters,
          targets: [target],
        } as DataQueryRequest<PromQuery>);
        const [result] = fetchMockCalledWith(fetchMock);
        expect(result).toMatchObject({
          expr: `metric{job="foo", k1=~"v.*", k2=~"v\\\\'.*"} - metric{k1=~"v.*", k2=~"v\\\\'.*"}`,
        });
      });
    });

    describe('with prometheusSpecialCharsInLabelValues enabled', () => {
      beforeAll(() => {
        config.featureToggles.prometheusSpecialCharsInLabelValues = true;
      });

      it('should not modify expression with no filters', async () => {
        ds.query({
          interval: '15s',
          range: getMockTimeRange(),
          targets: [target],
        } as DataQueryRequest<PromQuery>);
        const [result] = fetchMockCalledWith(fetchMock);
        expect(result).toMatchObject({ expr: DEFAULT_QUERY_EXPRESSION });
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
          {
            key: 'k3',
            operator: '=~',
            value: `v".*`,
          },
          {
            key: 'k4',
            operator: '=~',
            value: `\\v.*`,
          },
        ];
        ds.query({
          interval: '15s',
          range: getMockTimeRange(),
          filters,
          targets: [target],
        } as DataQueryRequest<PromQuery>);
        const [result] = fetchMockCalledWith(fetchMock);
        expect(result).toMatchObject({
          expr: `metric{job="foo", k1=~"v.*", k2=~"v'.*", k3=~"v\\".*", k4=~"\\\\v.*"} - metric{k1=~"v.*", k2=~"v'.*", k3=~"v\\".*", k4=~"\\\\v.*"}`,
        });
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

  describe('extractRuleMappingFromGroups()', () => {
    it('returns empty mapping for no rule groups', () => {
      expect(extractRuleMappingFromGroups([])).toEqual({});
    });

    it('returns a mapping for recording rules only', () => {
      const groups: RawRecordingRules[] = [
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
      expect(mapping).toEqual({
        'job:http_inprogress_requests:sum': [{ query: 'sum(http_inprogress_requests) by (job)' }],
      });
    });

    it('should extract rules with same name respecting its labels', () => {
      const groups: RawRecordingRules[] = [
        {
          name: 'nameOfTheGroup:uid11',
          file: 'the_file_123',
          rules: [
            {
              name: 'metric_5m',
              query: 'super_duper_query',
              labels: {
                uuid: 'uuid111',
              },
              type: 'recording',
            },
          ],
        },
        {
          name: 'nameOfTheGroup:uid22',
          file: 'the_file_456',
          rules: [
            {
              name: 'metric_5m',
              query: 'another_super_duper_query',
              labels: {
                uuid: 'uuid222',
              },
              type: 'recording',
            },
          ],
        },
      ];

      const mapping = extractRuleMappingFromGroups(groups);
      expect(mapping['metric_5m']).toBeDefined();
      expect(mapping['metric_5m'].length).toEqual(2);
      expect(mapping['metric_5m'][0].query).toEqual('super_duper_query');
      expect(mapping['metric_5m'][0].labels).toEqual({ uuid: 'uuid111' });
      expect(mapping['metric_5m'][1].query).toEqual('another_super_duper_query');
      expect(mapping['metric_5m'][1].labels).toEqual({ uuid: 'uuid222' });
    });
  });

  describe('Prometheus regular escaping', () => {
    describe('with prometheusSpecialCharsInLabelValues disabled', () => {
      beforeAll(() => {
        config.featureToggles.prometheusSpecialCharsInLabelValues = false;
      });

      it('should not escape non-string', () => {
        expect(prometheusRegularEscape(12)).toEqual(12);
      });

      it('should not escape strings without special characters', () => {
        expect(prometheusRegularEscape('cryptodepression')).toEqual('cryptodepression');
      });

      it('should escape single quotes', () => {
        expect(prometheusRegularEscape("looking'glass")).toEqual("looking\\\\'glass");
      });

      it('should escape backslashes', () => {
        expect(prometheusRegularEscape('looking\\glass')).toEqual('looking\\\\glass');
      });
    });

    describe('with prometheusSpecialCharsInLabelValues enabled', () => {
      beforeAll(() => {
        config.featureToggles.prometheusSpecialCharsInLabelValues = true;
      });

      it('should not escape non-string', () => {
        expect(prometheusRegularEscape(12)).toEqual(12);
      });

      it('should not escape strings without special characters', () => {
        expect(prometheusRegularEscape('cryptodepression')).toEqual('cryptodepression');
      });

      it('should not escape complete label matcher', () => {
        expect(prometheusRegularEscape('job="grafana"')).toEqual('job="grafana"');
        expect(prometheusRegularEscape('job!="grafana"')).toEqual('job!="grafana"');
        expect(prometheusRegularEscape('job=~"grafana"')).toEqual('job=~"grafana"');
        expect(prometheusRegularEscape('job!~"grafana"')).toEqual('job!~"grafana"');
      });

      it('should not escape single quotes', () => {
        expect(prometheusRegularEscape("looking'glass")).toEqual("looking'glass");
      });

      it('should escape double quotes', () => {
        expect(prometheusRegularEscape('looking"glass')).toEqual('looking\\"glass');
      });

      it('should escape backslashes', () => {
        expect(prometheusRegularEscape('looking\\glass')).toEqual('looking\\\\glass');
      });

      it('should handle complete label matchers with escaped content', () => {
        expect(prometheusRegularEscape('job="my\\"service"')).toEqual('job="my\\"service"');
        expect(prometheusRegularEscape('job="\\\\server"')).toEqual('job="\\\\server"');
      });
    });
  });

  describe('Prometheus regexes escaping', () => {
    describe('with prometheusSpecialCharsInLabelValues disabled', () => {
      beforeAll(() => {
        config.featureToggles.prometheusSpecialCharsInLabelValues = false;
      });

      it('should not escape strings without special characters', () => {
        expect(prometheusSpecialRegexEscape('cryptodepression')).toEqual('cryptodepression');
      });

      it('should escape special characters', () => {
        expect(prometheusSpecialRegexEscape('looking{glass')).toEqual('looking\\\\{glass');
        expect(prometheusSpecialRegexEscape('looking$glass')).toEqual('looking\\\\$glass');
        expect(prometheusSpecialRegexEscape('looking\\glass')).toEqual('looking\\\\\\\\glass');
        expect(prometheusSpecialRegexEscape('looking|glass')).toEqual('looking\\\\|glass');
      });

      it('should handle multiple special characters', () => {
        expect(prometheusSpecialRegexEscape('+looking$glass?')).toEqual('\\\\+looking\\\\$glass\\\\?');
      });
    });

    describe('with prometheusSpecialCharsInLabelValues enabled', () => {
      beforeAll(() => {
        config.featureToggles.prometheusSpecialCharsInLabelValues = true;
      });

      it('should not escape strings without special characters', () => {
        expect(prometheusSpecialRegexEscape('cryptodepression')).toEqual('cryptodepression');
      });

      it('should escape special characters', () => {
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

      it('should escape double quotes with special regex escaping', () => {
        expect(prometheusSpecialRegexEscape('looking"glass')).toEqual('looking\\\\\\"glass');
      });

      it('should handle multiple special characters', () => {
        expect(prometheusSpecialRegexEscape('+looking$glass?')).toEqual('\\\\+looking\\\\$glass\\\\?');
      });

      it('should handle mixed quotes and special characters', () => {
        expect(prometheusSpecialRegexEscape('+looking"$glass?')).toEqual('\\\\+looking\\\\\\"\\\\$glass\\\\?');
      });
    });
  });

  describe('When interpolating variables', () => {
    let customVariable: CustomVariableModel;
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
        error: null,
        rootStateKey: '',
        state: LoadingState.Done,
        description: '',
        label: undefined,
        hide: VariableHide.dontHide,
        skipUrlSync: false,
        index: -1,
      };
    });

    describe('with prometheusSpecialCharsInLabelValues disabled', () => {
      beforeAll(() => {
        config.featureToggles.prometheusSpecialCharsInLabelValues = false;
      });

      describe('and value is a string', () => {
        it('should escape single quotes', () => {
          expect(ds.interpolateQueryExpr("abc'$^*{}[]+?.()|", customVariable)).toEqual("abc\\\\'$^*{}[]+?.()|");
        });
      });
    });

    describe('with prometheusSpecialCharsInLabelValues enabled', () => {
      beforeAll(() => {
        config.featureToggles.prometheusSpecialCharsInLabelValues = true;
      });

      describe('and value is a string', () => {
        it('should only escape double quotes and backslashes', () => {
          expect(ds.interpolateQueryExpr('abc\'"$^*{}[]+?.()|\\', customVariable)).toEqual('abc\'\\"$^*{}[]+?.()|\\\\');
        });
      });
    });

    describe('and value is a number', () => {
      it('should return a number', () => {
        expect(ds.interpolateQueryExpr(1000 as unknown as string, customVariable)).toEqual(1000);
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
    afterEach(() => {
      config.featureToggles.promQLScope = undefined;
    });

    it('should call replace function 3 times', () => {
      const query: PromQuery = {
        expr: 'test{job="testjob"}',
        format: 'time_series',
        interval: '$Interval',
        refId: 'A',
      };
      const interval = '10m';
      replaceMock.mockReturnValue(interval);

      const queries = ds.interpolateVariablesInQueries([query], { Interval: { text: interval, value: interval } });
      expect(templateSrvStub.replace).toBeCalledTimes(3);
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

    it('should not apply adhoc filters when promQLScope is enabled', () => {
      config.featureToggles.promQLScope = true;
      ds.enhanceExprWithAdHocFilters = jest.fn();
      ds.generateScopeFilters = jest.fn();
      const queries = [
        {
          refId: 'A',
          expr: 'rate({bar="baz", job="foo"} [5m]',
        },
      ];
      ds.interpolateVariablesInQueries(queries, {});
      expect(ds.enhanceExprWithAdHocFilters).not.toHaveBeenCalled();
      expect(ds.generateScopeFilters).toHaveBeenCalled();
    });
  });

  describe('applyTemplateVariables', () => {
    afterAll(() => {
      replaceMock.mockImplementation((a: string, ...rest: unknown[]) => a);
    });

    afterEach(() => {
      config.featureToggles.promQLScope = false;
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

    it('should generate scope filters and **not** apply ad-hoc filters to expr', () => {
      config.featureToggles.promQLScope = true;
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

      const expectedScopeFilters: ScopeSpecFilter[] = [
        {
          key: 'k1',
          operator: 'equals',
          value: 'v1',
        },
        {
          key: 'k2',
          operator: 'not-equals',
          value: 'v2',
        },
      ];

      const result = ds.applyTemplateVariables(query, {}, filters);
      expect(result.expr).toBe('test{job="bar"}');
      expect(result.adhocFilters).toEqual(expectedScopeFilters);
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

    it('should replace variables in ad-hoc filters', () => {
      const searchPattern = /\$A/g;
      replaceMock.mockImplementation((a: string) => a?.replace(searchPattern, '99') ?? a);

      const query = {
        expr: 'test',
        refId: 'A',
      };
      const filters = [
        {
          key: 'job',
          operator: '=~',
          value: '$A',
        },
      ];

      const result = ds.applyTemplateVariables(query, {}, filters);
      expect(result).toMatchObject({ expr: 'test{job=~"99"}' });
    });

    it('should replace variables in adhoc filters on backend when promQLScope is enabled', () => {
      config.featureToggles.promQLScope = true;
      const searchPattern = /\$A/g;
      replaceMock.mockImplementation((a: string) => a?.replace(searchPattern, '99') ?? a);

      const query = {
        expr: 'test',
        refId: 'A',
      };
      const filters = [
        {
          key: 'job',
          operator: '=~',
          value: '$A',
        },
      ];
      const result = ds.applyTemplateVariables(query, {}, filters);
      expect(result).toMatchObject({
        expr: 'test',
        adhocFilters: [
          {
            key: 'job',
            operator: 'regex-match',
            value: '99',
          },
        ],
      });
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

    it('should use the default time range when no range provided in options', () => {
      const prometheusDatasource = new PrometheusDatasource(
        { ...instanceSettings, jsonData: { ...instanceSettings.jsonData, cacheLevel: PrometheusCacheLevel.None } },
        templateSrvStub
      );
      const query = 'query_result(topk(5,rate(http_request_duration_microseconds_count[$__interval])))';
      prometheusDatasource.metricFindQuery(query);

      // Last 6h
      const range = replaceMock.mock.calls[1][1].__range;
      const rangeMs = replaceMock.mock.calls[1][1].__range_ms;
      const rangeS = replaceMock.mock.calls[1][1].__range_s;
      expect(range).toEqual({ text: '21600s', value: '21600s' });
      expect(rangeMs).toEqual({ text: 21600000, value: 21600000 });
      expect(rangeS).toEqual({ text: 21600, value: 21600 });
    });
  });

  describe('extractResourceMatcher', () => {
    it('should extract matcher from given query and filters', () => {
      const queries: PromQuery[] = [
        {
          refId: 'A',
          expr: 'metric_name{job="testjob"}',
        },
      ];
      const filters: AdHocVariableFilter[] = [
        {
          key: 'instance',
          operator: '=',
          value: 'localhost',
        },
      ];

      const result = extractResourceMatcher(queries, filters);
      expect(result).toBe('{__name__=~"metric_name",instance="localhost"}');
    });

    it('should extract matcher from given query and empty filters', () => {
      const queries: PromQuery[] = [
        {
          refId: 'A',
          expr: 'metric_name{job="testjob"}',
        },
      ];
      const filters: AdHocVariableFilter[] = [];

      const result = extractResourceMatcher(queries, filters);
      expect(result).toBe('{__name__=~"metric_name"}');
    });

    it('should extract matcher from given empty query expr and filters', () => {
      const queries: PromQuery[] = [
        {
          refId: 'A',
          expr: '',
        },
      ];
      const filters: AdHocVariableFilter[] = [
        {
          key: 'instance',
          operator: '=',
          value: 'localhost',
        },
      ];

      const result = extractResourceMatcher(queries, filters);
      expect(result).toBe('{instance="localhost"}');
    });

    it('should extract matcher from given filters only', () => {
      const queries: PromQuery[] = [];
      const filters: AdHocVariableFilter[] = [
        {
          key: 'instance',
          operator: '=',
          value: 'localhost',
        },
        {
          key: 'job',
          operator: '!=',
          value: 'testjob',
        },
      ];

      const result = extractResourceMatcher(queries, filters);
      expect(result).toBe('{instance="localhost",job!="testjob"}');
    });

    it('should extract matcher as match-all from no query and filter', () => {
      const queries: PromQuery[] = [];
      const filters: AdHocVariableFilter[] = [];

      const result = extractResourceMatcher(queries, filters);
      expect(result).toBeUndefined();
    });

    it('should extract the correct matcher for queries with `... or vector(0)`', () => {
      const queries: PromQuery[] = [
        {
          refId: 'A',
          expr: `sum(increase(go_cpu_classes_idle_cpu_seconds_total[$__rate_interval])) or vector(0)`,
        },
      ];
      const filters: AdHocVariableFilter[] = [];

      const result = extractResourceMatcher(queries, filters);
      expect(result).toBe('{__name__=~"go_cpu_classes_idle_cpu_seconds_total"}');
    });
  });
});

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
      retrieveHistogramMetrics: jest.fn().mockReturnValue(['tns_request_duration_seconds_bucket']),
    } as unknown as PrometheusLanguageProviderInterface;

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

    describe('scope filters', () => {
      const instanceSettings = {
        access: 'proxy',
        id: 1,
        jsonData: {},
        name: 'scoped-prom',
        readOnly: false,
        type: 'prometheus',
        uid: 'scoped-prom',
      } as unknown as DataSourceInstanceSettings<PromOptions>;
      const ds = new PrometheusDatasource(instanceSettings, templateSrvStub);

      it('should convert each adhoc operator to scope operator properly', () => {
        const adhocFilter: AdHocVariableFilter[] = [
          { key: 'eq', value: 'eqv', operator: '=' },
          {
            key: 'neq',
            value: 'neqv',
            operator: '!=',
          },
          { key: 'reg', value: 'regv', operator: '=~' },
          { key: 'nreg', value: 'nregv', operator: '!~' },
          { key: 'foo', value: 'bar', operator: '=|' },
          { key: 'bar', value: 'baz', operator: '!=|' },
        ];
        const expectedScopeFilter: ScopeSpecFilter[] = [
          { key: 'eq', value: 'eqv', operator: 'equals' },
          {
            key: 'neq',
            value: 'neqv',
            operator: 'not-equals',
          },
          { key: 'reg', value: 'regv', operator: 'regex-match' },
          { key: 'nreg', value: 'nregv', operator: 'regex-not-match' },
          { key: 'foo', value: 'bar', operator: 'one-of' },
          { key: 'bar', value: 'baz', operator: 'not-one-of' },
        ];
        const result = ds.generateScopeFilters(adhocFilter);
        result.forEach((r, i) => {
          expect(r).toEqual(expectedScopeFilter[i]);
        });
      });
    });
  });
});

describe('PrometheusDatasource incremental query logic', () => {
  let ds: PrometheusDatasource;
  let mockCache: {
    requestInfo: jest.MockedFunction<(request: DataQueryRequest<PromQuery>) => CacheRequestInfo<PromQuery>>;
    procFrames: jest.MockedFunction<(...args: unknown[]) => unknown[]>;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockCache = {
      requestInfo: jest.fn().mockReturnValue({
        requests: [{ targets: [], range: getMockTimeRange() }],
        targetSignatures: new Map(),
        shouldCache: true,
      }),
      procFrames: jest.fn().mockReturnValue([]),
    };

    const incrementalInstanceSettings = {
      url: 'proxied',
      id: 1,
      uid: 'ABCDEF',
      access: 'proxy',
      user: 'test',
      password: 'mupp',
      jsonData: {
        customQueryParameters: '',
        cacheLevel: PrometheusCacheLevel.Low,
        incrementalQuerying: true,
      } as Partial<PromOptions>,
    } as unknown as DataSourceInstanceSettings<PromOptions>;

    ds = new PrometheusDatasource(incrementalInstanceSettings, templateSrvStub);
    ds.cache = mockCache as unknown as typeof ds.cache;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should use incremental query for normal queries when incrementalQuerying is true', async () => {
    const request = createDataRequest([{ expr: 'up', refId: 'A' }]);
    await lastValueFrom(ds.query(request));
    expect(mockCache.requestInfo).toHaveBeenCalled();
  });

  it('should disable incremental query when query contains $__range', async () => {
    const request = createDataRequest([{ expr: 'rate(up[$__range])', refId: 'A' }]);
    await lastValueFrom(ds.query(request));
    expect(mockCache.requestInfo).not.toHaveBeenCalled();
  });

  it('should disable incremental query when any target contains $__range', async () => {
    const request = createDataRequest([
      { expr: 'up', refId: 'A' },
      { expr: 'rate(cpu[$__range])', refId: 'B' },
    ]);
    await lastValueFrom(ds.query(request));
    expect(mockCache.requestInfo).not.toHaveBeenCalled();
  });

  it('should disable incremental query for instant queries', async () => {
    const request = createDataRequest([{ expr: 'up', refId: 'A', instant: true }]);
    await lastValueFrom(ds.query(request));
    expect(mockCache.requestInfo).not.toHaveBeenCalled();
  });
});
