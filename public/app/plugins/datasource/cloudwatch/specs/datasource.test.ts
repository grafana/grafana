import '../datasource';
import CloudWatchDatasource from '../datasource';
import * as dateMath from 'app/core/utils/datemath';
import _ from 'lodash';

describe('CloudWatchDatasource', function() {
  let instanceSettings = {
    jsonData: { defaultRegion: 'us-east-1', access: 'proxy' },
  };

  let templateSrv = {
    data: {},
    templateSettings: { interpolate: /\[\[([\s\S]+?)\]\]/g },
    replace: text => _.template(text, templateSrv.templateSettings)(templateSrv.data),
    variableExists: () => false,
  };

  let timeSrv = {
    time: { from: 'now-1h', to: 'now' },
    timeRange: () => {
      return {
        from: dateMath.parse(timeSrv.time.from, false),
        to: dateMath.parse(timeSrv.time.to, true),
      };
    },
  };
  let backendSrv = {};
  let ctx = <any>{
    backendSrv,
    templateSrv,
  };

  beforeEach(() => {
    ctx.ds = new CloudWatchDatasource(instanceSettings, {}, backendSrv, templateSrv, timeSrv);
  });

  describe('When performing CloudWatch query', function() {
    var requestParams;

    var query = {
      range: { from: 'now-1h', to: 'now' },
      rangeRaw: { from: 1483228800, to: 1483232400 },
      targets: [
        {
          region: 'us-east-1',
          namespace: 'AWS/EC2',
          metricName: 'CPUUtilization',
          dimensions: {
            InstanceId: 'i-12345678',
          },
          statistics: ['Average'],
          period: '300',
        },
      ],
    };

    var response = {
      timings: [null],
      results: {
        A: {
          error: '',
          refId: 'A',
          series: [
            {
              name: 'CPUUtilization_Average',
              points: [[1, 1483228800000], [2, 1483229100000], [5, 1483229700000]],
              tags: {
                InstanceId: 'i-12345678',
              },
            },
          ],
        },
      },
    };

    beforeEach(() => {
      ctx.backendSrv.datasourceRequest = jest.fn(params => {
        requestParams = params.data;
        return Promise.resolve({ data: response });
      });
    });

    it('should generate the correct query', function(done) {
      ctx.ds.query(query).then(function() {
        var params = requestParams.queries[0];
        expect(params.namespace).toBe(query.targets[0].namespace);
        expect(params.metricName).toBe(query.targets[0].metricName);
        expect(params.dimensions['InstanceId']).toBe('i-12345678');
        expect(params.statistics).toEqual(query.targets[0].statistics);
        expect(params.period).toBe(query.targets[0].period);
        done();
      });
    });

    it('should generate the correct query with interval variable', function(done) {
      ctx.templateSrv.data = {
        period: '10m',
      };

      var query = {
        range: { from: 'now-1h', to: 'now' },
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            region: 'us-east-1',
            namespace: 'AWS/EC2',
            metricName: 'CPUUtilization',
            dimensions: {
              InstanceId: 'i-12345678',
            },
            statistics: ['Average'],
            period: '[[period]]',
          },
        ],
      };

      ctx.ds.query(query).then(function() {
        var params = requestParams.queries[0];
        expect(params.period).toBe('600');
        done();
      });
    });

    it('should cancel query for invalid extended statistics', function () {
      var query = {
        range: { from: 'now-1h', to: 'now' },
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            region: 'us-east-1',
            namespace: 'AWS/EC2',
            metricName: 'CPUUtilization',
            dimensions: {
              InstanceId: 'i-12345678',
            },
            statistics: ['pNN.NN'],
            period: '60s',
          },
        ],
      };
      expect(ctx.ds.query.bind(ctx.ds, query)).toThrow(/Invalid extended statistics/);
    });

    it('should return series list', function(done) {
      ctx.ds.query(query).then(function(result) {
        expect(result.data[0].target).toBe(response.results.A.series[0].name);
        expect(result.data[0].datapoints[0][0]).toBe(response.results.A.series[0].points[0][0]);
        done();
      });
    });
  });

  describe('When query region is "default"', function() {
    it('should return the datasource region if empty or "default"', function() {
      var defaultRegion = instanceSettings.jsonData.defaultRegion;

      expect(ctx.ds.getActualRegion()).toBe(defaultRegion);
      expect(ctx.ds.getActualRegion('')).toBe(defaultRegion);
      expect(ctx.ds.getActualRegion('default')).toBe(defaultRegion);
    });

    it('should return the specified region if specified', function() {
      expect(ctx.ds.getActualRegion('some-fake-region-1')).toBe('some-fake-region-1');
    });

    var requestParams;
    beforeEach(function() {
      ctx.ds.performTimeSeriesQuery = jest.fn(request => {
        requestParams = request;
        return Promise.resolve({ data: {} });
      });
    });

    it('should query for the datasource region if empty or "default"', function(done) {
      var query = {
        range: { from: 'now-1h', to: 'now' },
        rangeRaw: { from: 1483228800, to: 1483232400 },
        targets: [
          {
            region: 'default',
            namespace: 'AWS/EC2',
            metricName: 'CPUUtilization',
            dimensions: {
              InstanceId: 'i-12345678',
            },
            statistics: ['Average'],
            period: 300,
          },
        ],
      };

      ctx.ds.query(query).then(function(result) {
        expect(requestParams.queries[0].region).toBe(instanceSettings.jsonData.defaultRegion);
        done();
      });
    });
  });

  describe('When performing CloudWatch query for extended statistics', function() {
    var query = {
      range: { from: 'now-1h', to: 'now' },
      rangeRaw: { from: 1483228800, to: 1483232400 },
      targets: [
        {
          region: 'us-east-1',
          namespace: 'AWS/ApplicationELB',
          metricName: 'TargetResponseTime',
          dimensions: {
            LoadBalancer: 'lb',
            TargetGroup: 'tg',
          },
          statistics: ['p90.00'],
          period: 300,
        },
      ],
    };

    var response = {
      timings: [null],
      results: {
        A: {
          error: '',
          refId: 'A',
          series: [
            {
              name: 'TargetResponseTime_p90.00',
              points: [[1, 1483228800000], [2, 1483229100000], [5, 1483229700000]],
              tags: {
                LoadBalancer: 'lb',
                TargetGroup: 'tg',
              },
            },
          ],
        },
      },
    };

    beforeEach(function() {
      ctx.backendSrv.datasourceRequest = jest.fn(params => {
        return Promise.resolve({ data: response });
      });
    });

    it('should return series list', function(done) {
      ctx.ds.query(query).then(function(result) {
        expect(result.data[0].target).toBe(response.results.A.series[0].name);
        expect(result.data[0].datapoints[0][0]).toBe(response.results.A.series[0].points[0][0]);
        done();
      });
    });
  });

  function describeMetricFindQuery(query, func) {
    describe('metricFindQuery ' + query, () => {
      let scenario: any = {};
      scenario.setup = setupCallback => {
        beforeEach(() => {
          setupCallback();
          ctx.backendSrv.datasourceRequest = jest.fn(args => {
            scenario.request = args.data;
            return Promise.resolve({ data: scenario.requestResponse });
          });
          ctx.ds.metricFindQuery(query).then(args => {
            scenario.result = args;
          });
        });
      };

      func(scenario);
    });
  }

  describeMetricFindQuery('regions()', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [{ rows: [['us-east-1', 'us-east-1']] }],
          },
        },
      };
    });

    it('should call __GetRegions and return result', () => {
      expect(scenario.result[0].text).toContain('us-east-1');
      expect(scenario.request.queries[0].type).toBe('metricFindQuery');
      expect(scenario.request.queries[0].subtype).toBe('regions');
    });
  });

  describeMetricFindQuery('namespaces()', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [{ rows: [['AWS/EC2', 'AWS/EC2']] }],
          },
        },
      };
    });

    it('should call __GetNamespaces and return result', () => {
      expect(scenario.result[0].text).toContain('AWS/EC2');
      expect(scenario.request.queries[0].type).toBe('metricFindQuery');
      expect(scenario.request.queries[0].subtype).toBe('namespaces');
    });
  });

  describeMetricFindQuery('metrics(AWS/EC2)', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [{ rows: [['CPUUtilization', 'CPUUtilization']] }],
          },
        },
      };
    });

    it('should call __GetMetrics and return result', () => {
      expect(scenario.result[0].text).toBe('CPUUtilization');
      expect(scenario.request.queries[0].type).toBe('metricFindQuery');
      expect(scenario.request.queries[0].subtype).toBe('metrics');
    });
  });

  describeMetricFindQuery('dimension_keys(AWS/EC2)', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [{ rows: [['InstanceId', 'InstanceId']] }],
          },
        },
      };
    });

    it('should call __GetDimensions and return result', () => {
      expect(scenario.result[0].text).toBe('InstanceId');
      expect(scenario.request.queries[0].type).toBe('metricFindQuery');
      expect(scenario.request.queries[0].subtype).toBe('dimension_keys');
    });
  });

  describeMetricFindQuery('dimension_values(us-east-1,AWS/EC2,CPUUtilization,InstanceId)', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [{ rows: [['i-12345678', 'i-12345678']] }],
          },
        },
      };
    });

    it('should call __ListMetrics and return result', () => {
      expect(scenario.result[0].text).toContain('i-12345678');
      expect(scenario.request.queries[0].type).toBe('metricFindQuery');
      expect(scenario.request.queries[0].subtype).toBe('dimension_values');
    });
  });

  describeMetricFindQuery('dimension_values(default,AWS/EC2,CPUUtilization,InstanceId)', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [{ rows: [['i-12345678', 'i-12345678']] }],
          },
        },
      };
    });

    it('should call __ListMetrics and return result', () => {
      expect(scenario.result[0].text).toContain('i-12345678');
      expect(scenario.request.queries[0].type).toBe('metricFindQuery');
      expect(scenario.request.queries[0].subtype).toBe('dimension_values');
    });
  });

  it('should caclculate the correct period', function() {
    var hourSec = 60 * 60;
    var daySec = hourSec * 24;
    var start = 1483196400 * 1000;
    var testData: any[] = [
      [
        { period: 60, namespace: 'AWS/EC2' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        hourSec * 3,
        60,
      ],
      [
        { period: null, namespace: 'AWS/EC2' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        hourSec * 3,
        300,
      ],
      [
        { period: 60, namespace: 'AWS/ELB' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        hourSec * 3,
        60,
      ],
      [
        { period: null, namespace: 'AWS/ELB' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        hourSec * 3,
        60,
      ],
      [
        { period: 1, namespace: 'CustomMetricsNamespace' },
        {
          range: {
            from: new Date(start),
            to: new Date(start + (1440 - 1) * 1000),
          },
        },
        hourSec * 3 - 1,
        1,
      ],
      [
        { period: 1, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        hourSec * 3 - 1,
        60,
      ],
      [
        { period: 60, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        hourSec * 3,
        60,
      ],
      [
        { period: null, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        hourSec * 3 - 1,
        60,
      ],
      [
        { period: null, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        hourSec * 3,
        60,
      ],
      [
        { period: null, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        daySec * 15,
        60,
      ],
      [
        { period: null, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        daySec * 63,
        300,
      ],
      [
        { period: null, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        daySec * 455,
        3600,
      ],
    ];
    for (let t of testData) {
      let target = t[0];
      let options = t[1];
      let now = new Date(options.range.from.valueOf() + t[2] * 1000);
      let expected = t[3];
      let actual = ctx.ds.getPeriod(target, options, now);
      expect(actual).toBe(expected);
    }
  });
});
