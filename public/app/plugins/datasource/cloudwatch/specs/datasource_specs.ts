import "../datasource";
import {describe, beforeEach, it, expect, angularMocks} from 'test/lib/common';
import helpers from 'test/specs/helpers';
import CloudWatchDatasource from "../datasource";

describe('CloudWatchDatasource', function() {
  var ctx = new helpers.ServiceTestContext();
  var instanceSettings = {
    jsonData: {defaultRegion: 'us-east-1', access: 'proxy'},
  };

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(angularMocks.module('grafana.controllers'));
  beforeEach(ctx.providePhase(['templateSrv', 'backendSrv']));

  beforeEach(angularMocks.inject(function($q, $rootScope, $httpBackend, $injector) {
    ctx.$q = $q;
    ctx.$httpBackend =  $httpBackend;
    ctx.$rootScope = $rootScope;
    ctx.ds = $injector.instantiate(CloudWatchDatasource, {instanceSettings: instanceSettings});
    $httpBackend.when('GET', /\.html$/).respond('');
  }));

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
            InstanceId: 'i-12345678'
          },
          statistics: ['Average'],
          period: '300'
        }
      ]
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
              points: [
                [1, 1483228800000],
                [2, 1483229100000],
                [5, 1483229700000],
              ],
              tags: {
                InstanceId: 'i-12345678'
              }
            }
          ]
        }
      }
    };

    beforeEach(function() {
      ctx.backendSrv.datasourceRequest = function(params) {
        requestParams = params.data;
        return ctx.$q.when({data: response});
      };
    });

    it('should generate the correct query', function(done) {
      ctx.ds.query(query).then(function() {
        var params = requestParams.queries[0];
        expect(params.namespace).to.be(query.targets[0].namespace);
        expect(params.metricName).to.be(query.targets[0].metricName);
        expect(params.dimensions['InstanceId']).to.be('i-12345678');
        expect(params.statistics).to.eql(query.targets[0].statistics);
        expect(params.period).to.be(query.targets[0].period);
        done();
      });
      ctx.$rootScope.$apply();
    });

    it('should generate the correct query with interval variable', function(done) {
      ctx.templateSrv.data = {
        period: '10m'
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
              InstanceId: 'i-12345678'
            },
            statistics: ['Average'],
            period: '[[period]]'
          }
        ]
      };

      ctx.ds.query(query).then(function() {
        var params = requestParams.queries[0];
        expect(params.period).to.be('600');
        done();
      });
      ctx.$rootScope.$apply();
    });

    it('should return series list', function(done) {
      ctx.ds.query(query).then(function(result) {
        expect(result.data[0].target).to.be(response.results.A.series[0].name);
        expect(result.data[0].datapoints[0][0]).to.be(response.results.A.series[0].points[0][0]);
        done();
      });
      ctx.$rootScope.$apply();
    });

    it('should generate the correct targets by expanding template variables', function() {
      var templateSrv = {
        variables: [
          {
            name: 'instance_id',
            options: [
              { text: 'i-23456789', value: 'i-23456789', selected: false },
              { text: 'i-34567890', value: 'i-34567890', selected: true }
            ]
          }
        ],
        replace: function (target, scopedVars) {
          if (target === '$instance_id' && scopedVars['instance_id']['text'] === 'i-34567890') {
            return 'i-34567890';
          } else {
            return '';
          }
        },
        getVariableName: function (e) { return 'instance_id'; },
        variableExists: function (e) { return true; },
        containsVariable: function (str, variableName) { return str.indexOf('$' + variableName) !== -1; }
      };

      var targets = [
        {
          region: 'us-east-1',
          namespace: 'AWS/EC2',
          metricName: 'CPUUtilization',
          dimensions: {
            InstanceId: '$instance_id'
          },
          statistics: ['Average'],
          period: 300
        }
      ];

      var result = ctx.ds.expandTemplateVariable(targets, {}, templateSrv);
      expect(result[0].dimensions.InstanceId).to.be('i-34567890');
    });
  });

  describe('When query region is "default"', function () {
    it('should return the datasource region if empty or "default"', function() {
      var defaultRegion = instanceSettings.jsonData.defaultRegion;

      expect(ctx.ds.getActualRegion()).to.be(defaultRegion);
      expect(ctx.ds.getActualRegion('')).to.be(defaultRegion);
      expect(ctx.ds.getActualRegion("default")).to.be(defaultRegion);
    });

    it('should return the specified region if specified', function() {
      expect(ctx.ds.getActualRegion('some-fake-region-1')).to.be('some-fake-region-1');
    });

    var requestParams;
    beforeEach(function() {
      ctx.ds.performTimeSeriesQuery = function(request) {
        requestParams = request;
        return ctx.$q.when({data: {}});
      };
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
              InstanceId: 'i-12345678'
            },
            statistics: ['Average'],
            period: 300
          }
        ]
      };

      ctx.ds.query(query).then(function(result) {
        expect(requestParams.queries[0].region).to.be(instanceSettings.jsonData.defaultRegion);
        done();
      });
      ctx.$rootScope.$apply();
    });


  });

  describe('When performing CloudWatch query for extended statistics', function() {
    var requestParams;

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
            TargetGroup: 'tg'
          },
          statistics: ['p90.00'],
          period: 300
        }
      ]
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
              points: [
                [1, 1483228800000],
                [2, 1483229100000],
                [5, 1483229700000],
              ],
              tags: {
                LoadBalancer: 'lb',
                TargetGroup: 'tg'
              }
            }
          ]
        }
      }
    };

    beforeEach(function() {
      ctx.backendSrv.datasourceRequest = function(params) {
        requestParams = params.data;
        return ctx.$q.when({data: response});
      };
    });

    it('should return series list', function(done) {
      ctx.ds.query(query).then(function(result) {
        expect(result.data[0].target).to.be(response.results.A.series[0].name);
        expect(result.data[0].datapoints[0][0]).to.be(response.results.A.series[0].points[0][0]);
        done();
      });
      ctx.$rootScope.$apply();
    });
  });

  function describeMetricFindQuery(query, func) {
    describe('metricFindQuery ' + query, () => {
      let scenario: any = {};
      scenario.setup = setupCallback => {
        beforeEach(() => {
          setupCallback();
          ctx.backendSrv.datasourceRequest = args => {
            scenario.request = args.data;
            return ctx.$q.when({data: scenario.requestResponse});
          };
          ctx.ds.metricFindQuery(query).then(args => {
            scenario.result = args;
          });
          ctx.$rootScope.$apply();
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
            tables: [
              { rows: [['us-east-1', 'us-east-1']] }
            ]
          }
        }
      };
    });

    it('should call __GetRegions and return result', () => {
      expect(scenario.result[0].text).to.contain('us-east-1');
      expect(scenario.request.queries[0].type).to.be('metricFindQuery');
      expect(scenario.request.queries[0].subtype).to.be('regions');
    });
  });

  describeMetricFindQuery('namespaces()', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [
              { rows: [['AWS/EC2', 'AWS/EC2']] }
            ]
          }
        }
      };
    });

    it('should call __GetNamespaces and return result', () => {
      expect(scenario.result[0].text).to.contain('AWS/EC2');
      expect(scenario.request.queries[0].type).to.be('metricFindQuery');
      expect(scenario.request.queries[0].subtype).to.be('namespaces');
    });
  });

  describeMetricFindQuery('metrics(AWS/EC2)', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [
              { rows: [['CPUUtilization', 'CPUUtilization']] }
            ]
          }
        }
      };
    });

    it('should call __GetMetrics and return result', () => {
      expect(scenario.result[0].text).to.be('CPUUtilization');
      expect(scenario.request.queries[0].type).to.be('metricFindQuery');
      expect(scenario.request.queries[0].subtype).to.be('metrics');
    });
  });

  describeMetricFindQuery('dimension_keys(AWS/EC2)', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [
              { rows: [['InstanceId', 'InstanceId']] }
            ]
          }
        }
      };
    });

    it('should call __GetDimensions and return result', () => {
      expect(scenario.result[0].text).to.be('InstanceId');
      expect(scenario.request.queries[0].type).to.be('metricFindQuery');
      expect(scenario.request.queries[0].subtype).to.be('dimension_keys');
    });
  });

  describeMetricFindQuery('dimension_values(us-east-1,AWS/EC2,CPUUtilization,InstanceId)', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [
              { rows: [['i-12345678', 'i-12345678']] }
            ]
          }
        }
      };
    });

    it('should call __ListMetrics and return result', () => {
      expect(scenario.result[0].text).to.contain('i-12345678');
      expect(scenario.request.queries[0].type).to.be('metricFindQuery');
      expect(scenario.request.queries[0].subtype).to.be('dimension_values');
    });
  });

  describeMetricFindQuery('dimension_values(default,AWS/EC2,CPUUtilization,InstanceId)', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        results: {
          metricFindQuery: {
            tables: [
              { rows: [['i-12345678', 'i-12345678']] }
            ]
          }
        }
      };
    });

    it('should call __ListMetrics and return result', () => {
      expect(scenario.result[0].text).to.contain('i-12345678');
      expect(scenario.request.queries[0].type).to.be('metricFindQuery');
      expect(scenario.request.queries[0].subtype).to.be('dimension_values');
    });
  });

  it('should caclculate the correct period', function () {
    var hourSec = 60 * 60;
    var daySec = hourSec * 24;
    var start = 1483196400 * 1000;
    var testData: any[] = [
      [
        { period: 60, namespace: 'AWS/EC2' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        (hourSec * 3), 60
      ],
      [
        { period: null, namespace: 'AWS/EC2' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        (hourSec * 3), 300
      ],
      [
        { period: 60, namespace: 'AWS/ELB' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        (hourSec * 3), 60
      ],
      [
        { period: null, namespace: 'AWS/ELB' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        (hourSec * 3), 60
      ],
      [
        { period: 1, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + (1440 - 1) * 1000) } },
        (hourSec * 3 - 1), 1
      ],
      [
        { period: 1, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        (hourSec * 3 - 1), 60
      ],
      [
        { period: 60, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        (hourSec * 3), 60
      ],
      [
        { period: null, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        (hourSec * 3 - 1), 60
      ],
      [
        { period: null, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        (hourSec * 3), 60
      ],
      [
        { period: null, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        (daySec * 15), 60
      ],
      [
        { period: null, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        (daySec * 63), 300
      ],
      [
        { period: null, namespace: 'CustomMetricsNamespace' },
        { range: { from: new Date(start), to: new Date(start + 3600 * 1000) } },
        (daySec * 455), 3600
      ]
    ];
    for (let t of testData) {
      let target = t[0];
      let options = t[1];
      let now = new Date(options.range.from.valueOf() + t[2] * 1000);
      let expected = t[3];
      let actual = ctx.ds.getPeriod(target, options, now);
      expect(actual).to.be(expected);
    }
  });

});
