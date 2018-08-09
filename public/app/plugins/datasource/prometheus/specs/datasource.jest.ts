import _ from 'lodash';
import moment from 'moment';
import q from 'q';
import {
  alignRange,
  determineQueryHints,
  extractRuleMappingFromGroups,
  PrometheusDatasource,
  prometheusSpecialRegexEscape,
  prometheusRegularEscape,
  addLabelToQuery,
} from '../datasource';

jest.mock('../metric_find_query');

describe('PrometheusDatasource', () => {
  let ctx: any = {};
  let instanceSettings = {
    url: 'proxied',
    directUrl: 'direct',
    user: 'test',
    password: 'mupp',
    jsonData: {},
  };

  ctx.backendSrvMock = {};

  ctx.templateSrvMock = {
    replace: a => a,
  };
  ctx.timeSrvMock = {
    timeRange: () => {
      return {
        from: moment(1531468681),
        to: moment(1531489712),
      };
    },
  };

  beforeEach(() => {
    ctx.ds = new PrometheusDatasource(instanceSettings, q, ctx.backendSrvMock, ctx.templateSrvMock, ctx.timeSrvMock);
  });

  describe('Datasource metadata requests', () => {
    it('should perform a GET request with the default config', () => {
      ctx.backendSrvMock.datasourceRequest = jest.fn();
      ctx.ds.metadataRequest('/foo');
      expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
      expect(ctx.backendSrvMock.datasourceRequest.mock.calls[0][0].method).toBe('GET');
    });

    it('should still perform a GET request with the DS HTTP method set to POST', () => {
      ctx.backendSrvMock.datasourceRequest = jest.fn();
      const postSettings = _.cloneDeep(instanceSettings);
      postSettings.jsonData.httpMethod = 'POST';
      const ds = new PrometheusDatasource(postSettings, q, ctx.backendSrvMock, ctx.templateSrvMock, ctx.timeSrvMock);
      ds.metadataRequest('/foo');
      expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
      expect(ctx.backendSrvMock.datasourceRequest.mock.calls[0][0].method).toBe('GET');
    });
  });

  describe('When performing performSuggestQuery', () => {
    it('should cache response', async () => {
      ctx.backendSrvMock.datasourceRequest.mockReturnValue(
        Promise.resolve({
          status: 'success',
          data: { data: ['value1', 'value2', 'value3'] },
        })
      );

      let results = await ctx.ds.performSuggestQuery('value', true);

      expect(results).toHaveLength(3);

      ctx.backendSrvMock.datasourceRequest.mockReset();
      results = await ctx.ds.performSuggestQuery('value', true);

      expect(results).toHaveLength(3);
    });
  });

  describe('When converting prometheus histogram to heatmap format', () => {
    beforeEach(() => {
      ctx.query = {
        range: { from: moment(1443454528000), to: moment(1443454528000) },
        targets: [{ expr: 'test{job="testjob"}', format: 'heatmap', legendFormat: '{{le}}' }],
        interval: '1s',
      };
    });

    it('should convert cumullative histogram to ordinary', () => {
      const resultMock = [
        {
          metric: { __name__: 'metric', job: 'testjob', le: '10' },
          values: [[1443454528.0, '10'], [1443454528.0, '10']],
        },
        {
          metric: { __name__: 'metric', job: 'testjob', le: '20' },
          values: [[1443454528.0, '20'], [1443454528.0, '10']],
        },
        {
          metric: { __name__: 'metric', job: 'testjob', le: '30' },
          values: [[1443454528.0, '25'], [1443454528.0, '10']],
        },
      ];
      const responseMock = { data: { data: { result: resultMock } } };

      const expected = [
        {
          target: '10',
          datapoints: [[10, 1443454528000], [10, 1443454528000]],
        },
        {
          target: '20',
          datapoints: [[10, 1443454528000], [0, 1443454528000]],
        },
        {
          target: '30',
          datapoints: [[5, 1443454528000], [0, 1443454528000]],
        },
      ];

      ctx.ds.performTimeSeriesQuery = jest.fn().mockReturnValue(responseMock);
      return ctx.ds.query(ctx.query).then(result => {
        let results = result.data;
        return expect(results).toMatchObject(expected);
      });
    });

    it('should sort series by label value', () => {
      const resultMock = [
        {
          metric: { __name__: 'metric', job: 'testjob', le: '2' },
          values: [[1443454528.0, '10'], [1443454528.0, '10']],
        },
        {
          metric: { __name__: 'metric', job: 'testjob', le: '4' },
          values: [[1443454528.0, '20'], [1443454528.0, '10']],
        },
        {
          metric: { __name__: 'metric', job: 'testjob', le: '+Inf' },
          values: [[1443454528.0, '25'], [1443454528.0, '10']],
        },
        {
          metric: { __name__: 'metric', job: 'testjob', le: '1' },
          values: [[1443454528.0, '25'], [1443454528.0, '10']],
        },
      ];
      const responseMock = { data: { data: { result: resultMock } } };

      const expected = ['1', '2', '4', '+Inf'];

      ctx.ds.performTimeSeriesQuery = jest.fn().mockReturnValue(responseMock);
      return ctx.ds.query(ctx.query).then(result => {
        let seriesLabels = _.map(result.data, 'target');
        return expect(seriesLabels).toEqual(expected);
      });
    });
  });

  describe('alignRange', () => {
    it('does not modify already aligned intervals with perfect step', () => {
      const range = alignRange(0, 3, 3);
      expect(range.start).toEqual(0);
      expect(range.end).toEqual(3);
    });
    it('does modify end-aligned intervals to reflect number of steps possible', () => {
      const range = alignRange(1, 6, 3);
      expect(range.start).toEqual(0);
      expect(range.end).toEqual(6);
    });
    it('does align intervals that are a multiple of steps', () => {
      const range = alignRange(1, 4, 3);
      expect(range.start).toEqual(0);
      expect(range.end).toEqual(6);
    });
    it('does align intervals that are not a multiple of steps', () => {
      const range = alignRange(1, 5, 3);
      expect(range.start).toEqual(0);
      expect(range.end).toEqual(6);
    });
  });

  describe('determineQueryHints()', () => {
    it('returns no hints for no series', () => {
      expect(determineQueryHints([])).toEqual([]);
    });

    it('returns no hints for empty series', () => {
      expect(determineQueryHints([{ datapoints: [], query: '' }])).toEqual([null]);
    });

    it('returns no hint for a monotonously decreasing series', () => {
      const series = [{ datapoints: [[23, 1000], [22, 1001]], query: 'metric', responseIndex: 0 }];
      const hints = determineQueryHints(series);
      expect(hints).toEqual([null]);
    });

    it('returns a rate hint for a monotonously increasing series', () => {
      const series = [{ datapoints: [[23, 1000], [24, 1001]], query: 'metric', responseIndex: 0 }];
      const hints = determineQueryHints(series);
      expect(hints.length).toBe(1);
      expect(hints[0]).toMatchObject({
        label: 'Time series is monotonously increasing.',
        index: 0,
        fix: {
          action: {
            type: 'ADD_RATE',
            query: 'metric',
          },
        },
      });
    });

    it('returns a histogram hint for a bucket series', () => {
      const series = [{ datapoints: [[23, 1000]], query: 'metric_bucket', responseIndex: 0 }];
      const hints = determineQueryHints(series);
      expect(hints.length).toBe(1);
      expect(hints[0]).toMatchObject({
        label: 'Time series has buckets, you probably wanted a histogram.',
        index: 0,
        fix: {
          action: {
            type: 'ADD_HISTOGRAM_QUANTILE',
            query: 'metric_bucket',
          },
        },
      });
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

  describe('Prometheus regular escaping', () => {
    it('should not escape non-string', () => {
      expect(prometheusRegularEscape(12)).toEqual(12);
    });
    it('should not escape simple string', () => {
      expect(prometheusRegularEscape('cryptodepression')).toEqual('cryptodepression');
    });
    it("should escape '", () => {
      expect(prometheusRegularEscape("looking'glass")).toEqual("looking\\\\'glass");
    });
    it('should escape multiple characters', () => {
      expect(prometheusRegularEscape("'looking'glass'")).toEqual("\\\\'looking\\\\'glass\\\\'");
    });
  });

  describe('Prometheus regexes escaping', () => {
    it('should not escape simple string', () => {
      expect(prometheusSpecialRegexEscape('cryptodepression')).toEqual('cryptodepression');
    });
    it('should escape $^*+?.()\\', () => {
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
    });
    it('should escape multiple special characters', () => {
      expect(prometheusSpecialRegexEscape('+looking$glass?')).toEqual('\\\\+looking\\\\$glass\\\\?');
    });
  });

  describe('metricFindQuery', () => {
    beforeEach(() => {
      let query = 'query_result(topk(5,rate(http_request_duration_microseconds_count[$__interval])))';
      ctx.templateSrvMock.replace = jest.fn();
      ctx.timeSrvMock.timeRange = () => {
        return {
          from: moment(1531468681),
          to: moment(1531489712),
        };
      };
      ctx.ds = new PrometheusDatasource(instanceSettings, q, ctx.backendSrvMock, ctx.templateSrvMock, ctx.timeSrvMock);
      ctx.ds.metricFindQuery(query);
    });

    it('should call templateSrv.replace with scopedVars', () => {
      expect(ctx.templateSrvMock.replace.mock.calls[0][1]).toBeDefined();
    });

    it('should have the correct range and range_ms', () => {
      let range = ctx.templateSrvMock.replace.mock.calls[0][1].__range;
      let rangeMs = ctx.templateSrvMock.replace.mock.calls[0][1].__range_ms;
      expect(range).toEqual({ text: '21s', value: '21s' });
      expect(rangeMs).toEqual({ text: 21031, value: 21031 });
    });

    it('should pass the default interval value', () => {
      let interval = ctx.templateSrvMock.replace.mock.calls[0][1].__interval;
      let intervalMs = ctx.templateSrvMock.replace.mock.calls[0][1].__interval_ms;
      expect(interval).toEqual({ text: '15s', value: '15s' });
      expect(intervalMs).toEqual({ text: 15000, value: 15000 });
    });
  });

  describe('addLabelToQuery()', () => {
    expect(() => {
      addLabelToQuery('foo', '', '');
    }).toThrow();
    expect(addLabelToQuery('foo + foo', 'bar', 'baz')).toBe('foo{bar="baz"} + foo{bar="baz"}');
    expect(addLabelToQuery('foo{}', 'bar', 'baz')).toBe('foo{bar="baz"}');
    expect(addLabelToQuery('foo{x="yy"}', 'bar', 'baz')).toBe('foo{bar="baz",x="yy"}');
    expect(addLabelToQuery('foo{x="yy"} + metric', 'bar', 'baz')).toBe('foo{bar="baz",x="yy"} + metric{bar="baz"}');
    expect(addLabelToQuery('avg(foo) + sum(xx_yy)', 'bar', 'baz')).toBe('avg(foo{bar="baz"}) + sum(xx_yy{bar="baz"})');
    expect(addLabelToQuery('foo{x="yy"} * metric{y="zz",a="bb"} * metric2', 'bar', 'baz')).toBe(
      'foo{bar="baz",x="yy"} * metric{a="bb",bar="baz",y="zz"} * metric2{bar="baz"}'
    );
    expect(addLabelToQuery('sum by (xx) (foo)', 'bar', 'baz')).toBe('sum by (xx) (foo{bar="baz"})');
    expect(addLabelToQuery('foo{instance="my-host.com:9100"}', 'bar', 'baz')).toBe(
      'foo{bar="baz",instance="my-host.com:9100"}'
    );
  });
});

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const time = ({ hours = 0, seconds = 0, minutes = 0 }) => moment(hours * HOUR + minutes * MINUTE + seconds * SECOND);

let ctx = <any>{};
let instanceSettings = {
  url: 'proxied',
  directUrl: 'direct',
  user: 'test',
  password: 'mupp',
  jsonData: { httpMethod: 'GET' },
};
let backendSrv = <any>{
  datasourceRequest: jest.fn(),
};

let templateSrv = {
  replace: jest.fn(str => str),
};

let timeSrv = {
  timeRange: () => {
    return { to: { diff: () => 2000 }, from: '' };
  },
};

describe('PrometheusDatasource', () => {
  describe('When querying prometheus with one target using query editor target spec', async () => {
    var results;
    var query = {
      range: { from: time({ seconds: 63 }), to: time({ seconds: 183 }) },
      targets: [{ expr: 'test{job="testjob"}', format: 'time_series' }],
      interval: '60s',
    };
    // Interval alignment with step
    var urlExpected =
      'proxied/api/v1/query_range?query=' + encodeURIComponent('test{job="testjob"}') + '&start=60&end=240&step=60';

    beforeEach(async () => {
      let response = {
        data: {
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [
              {
                metric: { __name__: 'test', job: 'testjob' },
                values: [[60, '3846']],
              },
            ],
          },
        },
      };
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);

      await ctx.ds.query(query).then(function(data) {
        results = data;
      });
    });

    it('should generate the correct query', () => {
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should return series list', async () => {
      expect(results.data.length).toBe(1);
      expect(results.data[0].target).toBe('test{job="testjob"}');
    });
  });
  describe('When querying prometheus with one target which return multiple series', () => {
    var results;
    var start = 60;
    var end = 360;
    var step = 60;

    var query = {
      range: { from: time({ seconds: start }), to: time({ seconds: end }) },
      targets: [{ expr: 'test{job="testjob"}', format: 'time_series' }],
      interval: '60s',
    };

    beforeEach(async () => {
      let response = {
        status: 'success',
        data: {
          data: {
            resultType: 'matrix',
            result: [
              {
                metric: { __name__: 'test', job: 'testjob', series: 'series 1' },
                values: [[start + step * 1, '3846'], [start + step * 3, '3847'], [end - step * 1, '3848']],
              },
              {
                metric: { __name__: 'test', job: 'testjob', series: 'series 2' },
                values: [[start + step * 2, '4846']],
              },
            ],
          },
        },
      };

      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);

      await ctx.ds.query(query).then(function(data) {
        results = data;
      });
    });

    it('should be same length', () => {
      expect(results.data.length).toBe(2);
      expect(results.data[0].datapoints.length).toBe((end - start) / step + 1);
      expect(results.data[1].datapoints.length).toBe((end - start) / step + 1);
    });

    it('should fill null until first datapoint in response', () => {
      expect(results.data[0].datapoints[0][1]).toBe(start * 1000);
      expect(results.data[0].datapoints[0][0]).toBe(null);
      expect(results.data[0].datapoints[1][1]).toBe((start + step * 1) * 1000);
      expect(results.data[0].datapoints[1][0]).toBe(3846);
    });
    it('should fill null after last datapoint in response', () => {
      var length = (end - start) / step + 1;
      expect(results.data[0].datapoints[length - 2][1]).toBe((end - step * 1) * 1000);
      expect(results.data[0].datapoints[length - 2][0]).toBe(3848);
      expect(results.data[0].datapoints[length - 1][1]).toBe(end * 1000);
      expect(results.data[0].datapoints[length - 1][0]).toBe(null);
    });
    it('should fill null at gap between series', () => {
      expect(results.data[0].datapoints[2][1]).toBe((start + step * 2) * 1000);
      expect(results.data[0].datapoints[2][0]).toBe(null);
      expect(results.data[1].datapoints[1][1]).toBe((start + step * 1) * 1000);
      expect(results.data[1].datapoints[1][0]).toBe(null);
      expect(results.data[1].datapoints[3][1]).toBe((start + step * 3) * 1000);
      expect(results.data[1].datapoints[3][0]).toBe(null);
    });
  });
  describe('When querying prometheus with one target and instant = true', () => {
    var results;
    var urlExpected = 'proxied/api/v1/query?query=' + encodeURIComponent('test{job="testjob"}') + '&time=123';
    var query = {
      range: { from: time({ seconds: 63 }), to: time({ seconds: 123 }) },
      targets: [{ expr: 'test{job="testjob"}', format: 'time_series', instant: true }],
      interval: '60s',
    };

    beforeEach(async () => {
      let response = {
        status: 'success',
        data: {
          data: {
            resultType: 'vector',
            result: [
              {
                metric: { __name__: 'test', job: 'testjob' },
                value: [123, '3846'],
              },
            ],
          },
        },
      };

      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);

      await ctx.ds.query(query).then(function(data) {
        results = data;
      });
    });
    it('should generate the correct query', () => {
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should return series list', () => {
      expect(results.data.length).toBe(1);
      expect(results.data[0].target).toBe('test{job="testjob"}');
    });
  });
  describe('When performing annotationQuery', () => {
    var results;

    var options = {
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
    };

    beforeEach(async () => {
      let response = {
        status: 'success',
        data: {
          data: {
            resultType: 'matrix',
            result: [
              {
                metric: {
                  __name__: 'ALERTS',
                  alertname: 'InstanceDown',
                  alertstate: 'firing',
                  instance: 'testinstance',
                  job: 'testjob',
                },
                values: [[123, '1']],
              },
            ],
          },
        },
      };

      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);

      await ctx.ds.annotationQuery(options).then(function(data) {
        results = data;
      });
    });
    it('should return annotation list', () => {
      expect(results.length).toBe(1);
      expect(results[0].tags).toContain('testjob');
      expect(results[0].title).toBe('InstanceDown');
      expect(results[0].text).toBe('testinstance');
      expect(results[0].time).toBe(123 * 1000);
    });
  });

  describe('When resultFormat is table and instant = true', () => {
    var results;
    var query = {
      range: { from: time({ seconds: 63 }), to: time({ seconds: 123 }) },
      targets: [{ expr: 'test{job="testjob"}', format: 'time_series', instant: true }],
      interval: '60s',
    };

    beforeEach(async () => {
      let response = {
        status: 'success',
        data: {
          data: {
            resultType: 'vector',
            result: [
              {
                metric: { __name__: 'test', job: 'testjob' },
                value: [123, '3846'],
              },
            ],
          },
        },
      };

      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query).then(function(data) {
        results = data;
      });
    });

    it('should return result', () => {
      expect(results).not.toBe(null);
    });
  });

  describe('The "step" query parameter', () => {
    var response = {
      status: 'success',
      data: {
        data: {
          resultType: 'matrix',
          result: [],
        },
      },
    };

    it('should be min interval when greater than auto interval', async () => {
      let query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'test',
            interval: '10s',
          },
        ],
        interval: '5s',
      };
      let urlExpected = 'proxied/api/v1/query_range?query=test&start=60&end=420&step=10';

      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });

    it('step should never go below 1', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [{ expr: 'test' }],
        interval: '100ms',
      };
      var urlExpected = 'proxied/api/v1/query_range?query=test&start=60&end=420&step=1';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });

    it('should be auto interval when greater than min interval', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'test',
            interval: '5s',
          },
        ],
        interval: '10s',
      };
      var urlExpected = 'proxied/api/v1/query_range?query=test&start=60&end=420&step=10';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should result in querying fewer than 11000 data points', async () => {
      var query = {
        // 6 hour range
        range: { from: time({ hours: 1 }), to: time({ hours: 7 }) },
        targets: [{ expr: 'test' }],
        interval: '1s',
      };
      var end = 7 * 60 * 60;
      var start = 60 * 60;
      var urlExpected = 'proxied/api/v1/query_range?query=test&start=' + start + '&end=' + end + '&step=2';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should not apply min interval when interval * intervalFactor greater', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'test',
            interval: '10s',
            intervalFactor: 10,
          },
        ],
        interval: '5s',
      };
      // times get rounded up to interval
      var urlExpected = 'proxied/api/v1/query_range?query=test&start=50&end=450&step=50';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should apply min interval when interval * intervalFactor smaller', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'test',
            interval: '15s',
            intervalFactor: 2,
          },
        ],
        interval: '5s',
      };
      var urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=60&end=420&step=15';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should apply intervalFactor to auto interval when greater', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'test',
            interval: '5s',
            intervalFactor: 10,
          },
        ],
        interval: '10s',
      };
      // times get aligned to interval
      var urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=0&end=500&step=100';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should not not be affected by the 11000 data points limit when large enough', async () => {
      var query = {
        // 1 week range
        range: { from: time({}), to: time({ hours: 7 * 24 }) },
        targets: [
          {
            expr: 'test',
            intervalFactor: 10,
          },
        ],
        interval: '10s',
      };
      var end = 7 * 24 * 60 * 60;
      var start = 0;
      var urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=' + start + '&end=' + end + '&step=100';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
    it('should be determined by the 11000 data points limit when too small', async () => {
      var query = {
        // 1 week range
        range: { from: time({}), to: time({ hours: 7 * 24 }) },
        targets: [
          {
            expr: 'test',
            intervalFactor: 10,
          },
        ],
        interval: '5s',
      };
      var end = 7 * 24 * 60 * 60;
      var start = 0;
      var urlExpected = 'proxied/api/v1/query_range?query=test' + '&start=' + start + '&end=' + end + '&step=60';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);
    });
  });

  describe('The __interval and __interval_ms template variables', () => {
    var response = {
      status: 'success',
      data: {
        data: {
          resultType: 'matrix',
          result: [],
        },
      },
    };

    it('should be unchanged when auto interval is greater than min interval', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'rate(test[$__interval])',
            interval: '5s',
          },
        ],
        interval: '10s',
        scopedVars: {
          __interval: { text: '10s', value: '10s' },
          __interval_ms: { text: 10 * 1000, value: 10 * 1000 },
        },
      };

      var urlExpected =
        'proxied/api/v1/query_range?query=' +
        encodeURIComponent('rate(test[$__interval])') +
        '&start=60&end=420&step=10';

      templateSrv.replace = jest.fn(str => str);
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);

      expect(templateSrv.replace.mock.calls[0][1]).toEqual({
        __interval: {
          text: '10s',
          value: '10s',
        },
        __interval_ms: {
          text: 10000,
          value: 10000,
        },
      });
    });
    it('should be min interval when it is greater than auto interval', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'rate(test[$__interval])',
            interval: '10s',
          },
        ],
        interval: '5s',
        scopedVars: {
          __interval: { text: '5s', value: '5s' },
          __interval_ms: { text: 5 * 1000, value: 5 * 1000 },
        },
      };
      var urlExpected =
        'proxied/api/v1/query_range?query=' +
        encodeURIComponent('rate(test[$__interval])') +
        '&start=60&end=420&step=10';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      templateSrv.replace = jest.fn(str => str);
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);

      expect(templateSrv.replace.mock.calls[0][1]).toEqual({
        __interval: {
          text: '5s',
          value: '5s',
        },
        __interval_ms: {
          text: 5000,
          value: 5000,
        },
      });
    });
    it('should account for intervalFactor', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'rate(test[$__interval])',
            interval: '5s',
            intervalFactor: 10,
          },
        ],
        interval: '10s',
        scopedVars: {
          __interval: { text: '10s', value: '10s' },
          __interval_ms: { text: 10 * 1000, value: 10 * 1000 },
        },
      };
      var urlExpected =
        'proxied/api/v1/query_range?query=' +
        encodeURIComponent('rate(test[$__interval])') +
        '&start=0&end=500&step=100';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      templateSrv.replace = jest.fn(str => str);
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);

      expect(templateSrv.replace.mock.calls[0][1]).toEqual({
        __interval: {
          text: '10s',
          value: '10s',
        },
        __interval_ms: {
          text: 10000,
          value: 10000,
        },
      });

      expect(query.scopedVars.__interval.text).toBe('10s');
      expect(query.scopedVars.__interval.value).toBe('10s');
      expect(query.scopedVars.__interval_ms.text).toBe(10 * 1000);
      expect(query.scopedVars.__interval_ms.value).toBe(10 * 1000);
    });
    it('should be interval * intervalFactor when greater than min interval', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'rate(test[$__interval])',
            interval: '10s',
            intervalFactor: 10,
          },
        ],
        interval: '5s',
        scopedVars: {
          __interval: { text: '5s', value: '5s' },
          __interval_ms: { text: 5 * 1000, value: 5 * 1000 },
        },
      };
      var urlExpected =
        'proxied/api/v1/query_range?query=' +
        encodeURIComponent('rate(test[$__interval])') +
        '&start=50&end=450&step=50';

      templateSrv.replace = jest.fn(str => str);
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);

      expect(templateSrv.replace.mock.calls[0][1]).toEqual({
        __interval: {
          text: '5s',
          value: '5s',
        },
        __interval_ms: {
          text: 5000,
          value: 5000,
        },
      });
    });
    it('should be min interval when greater than interval * intervalFactor', async () => {
      var query = {
        // 6 minute range
        range: { from: time({ minutes: 1 }), to: time({ minutes: 7 }) },
        targets: [
          {
            expr: 'rate(test[$__interval])',
            interval: '15s',
            intervalFactor: 2,
          },
        ],
        interval: '5s',
        scopedVars: {
          __interval: { text: '5s', value: '5s' },
          __interval_ms: { text: 5 * 1000, value: 5 * 1000 },
        },
      };
      var urlExpected =
        'proxied/api/v1/query_range?query=' +
        encodeURIComponent('rate(test[$__interval])') +
        '&start=60&end=420&step=15';

      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);

      expect(templateSrv.replace.mock.calls[0][1]).toEqual({
        __interval: {
          text: '5s',
          value: '5s',
        },
        __interval_ms: {
          text: 5000,
          value: 5000,
        },
      });
    });
    it('should be determined by the 11000 data points limit, accounting for intervalFactor', async () => {
      var query = {
        // 1 week range
        range: { from: time({}), to: time({ hours: 7 * 24 }) },
        targets: [
          {
            expr: 'rate(test[$__interval])',
            intervalFactor: 10,
          },
        ],
        interval: '5s',
        scopedVars: {
          __interval: { text: '5s', value: '5s' },
          __interval_ms: { text: 5 * 1000, value: 5 * 1000 },
        },
      };
      var end = 7 * 24 * 60 * 60;
      var start = 0;
      var urlExpected =
        'proxied/api/v1/query_range?query=' +
        encodeURIComponent('rate(test[$__interval])') +
        '&start=' +
        start +
        '&end=' +
        end +
        '&step=60';
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      templateSrv.replace = jest.fn(str => str);
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query);
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('GET');
      expect(res.url).toBe(urlExpected);

      expect(templateSrv.replace.mock.calls[0][1]).toEqual({
        __interval: {
          text: '5s',
          value: '5s',
        },
        __interval_ms: {
          text: 5000,
          value: 5000,
        },
      });
    });
  });
});

describe('PrometheusDatasource for POST', () => {
  //   var ctx = new helpers.ServiceTestContext();
  let instanceSettings = {
    url: 'proxied',
    directUrl: 'direct',
    user: 'test',
    password: 'mupp',
    jsonData: { httpMethod: 'POST' },
  };

  describe('When querying prometheus with one target using query editor target spec', () => {
    var results;
    var urlExpected = 'proxied/api/v1/query_range';
    var dataExpected = {
      query: 'test{job="testjob"}',
      start: 1 * 60,
      end: 3 * 60,
      step: 60,
    };
    var query = {
      range: { from: time({ minutes: 1, seconds: 3 }), to: time({ minutes: 2, seconds: 3 }) },
      targets: [{ expr: 'test{job="testjob"}', format: 'time_series' }],
      interval: '60s',
    };

    beforeEach(async () => {
      let response = {
        status: 'success',
        data: {
          data: {
            resultType: 'matrix',
            result: [
              {
                metric: { __name__: 'test', job: 'testjob' },
                values: [[2 * 60, '3846']],
              },
            ],
          },
        },
      };
      backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
      ctx.ds = new PrometheusDatasource(instanceSettings, q, <any>backendSrv, templateSrv, timeSrv);
      await ctx.ds.query(query).then(function(data) {
        results = data;
      });
    });
    it('should generate the correct query', () => {
      let res = backendSrv.datasourceRequest.mock.calls[0][0];
      expect(res.method).toBe('POST');
      expect(res.url).toBe(urlExpected);
      expect(res.data).toEqual(dataExpected);
    });
    it('should return series list', () => {
      expect(results.data.length).toBe(1);
      expect(results.data[0].target).toBe('test{job="testjob"}');
    });
  });
});
