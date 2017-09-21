
import "../datasource";
import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';
import moment from 'moment';
import helpers from 'test/specs/helpers';
import {CloudWatchDatasource} from "../datasource";

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
      targets: [
        {
          region: 'us-east-1',
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

    var response = {
      Datapoints: [
        {
          Average: 1,
          Timestamp: 'Wed Dec 31 1969 16:00:00 GMT-0800 (PST)'
        },
        {
          Average: 2,
          Timestamp: 'Wed Dec 31 1969 16:05:00 GMT-0800 (PST)'
        },
        {
          Average: 5,
          Timestamp: 'Wed Dec 31 1969 16:15:00 GMT-0800 (PST)'
        }
      ],
      Label: 'CPUUtilization'
    };

    beforeEach(function() {
      ctx.backendSrv.datasourceRequest = function(params) {
        requestParams = params;
        return ctx.$q.when({data: response});
      };
    });

    it('should generate the correct query', function(done) {
      ctx.ds.query(query).then(function() {
        var params = requestParams.data.parameters;
        expect(params.namespace).to.be(query.targets[0].namespace);
        expect(params.metricName).to.be(query.targets[0].metricName);
        expect(params.dimensions[0].Name).to.be(Object.keys(query.targets[0].dimensions)[0]);
        expect(params.dimensions[0].Value).to.be(query.targets[0].dimensions[Object.keys(query.targets[0].dimensions)[0]]);
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
        var params = requestParams.data.parameters;
        expect(params.period).to.be(600);
        done();
      });
      ctx.$rootScope.$apply();
    });

    it('should return series list', function(done) {
      ctx.ds.query(query).then(function(result) {
        expect(result.data[0].target).to.be('CPUUtilization_Average');
        expect(result.data[0].datapoints[0][0]).to.be(response.Datapoints[0]['Average']);
        done();
      });
      ctx.$rootScope.$apply();
    });

    it('should return null for missing data point', function(done) {
      ctx.ds.query(query).then(function(result) {
        expect(result.data[0].datapoints[2][0]).to.be(null);
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

  describe('When performing CloudWatch query for extended statistics', function() {
    var requestParams;

    var query = {
      range: { from: 'now-1h', to: 'now' },
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
      Datapoints: [
        {
          ExtendedStatistics: {
            'p90.00': 1
          },
          Timestamp: 'Wed Dec 31 1969 16:00:00 GMT-0800 (PST)'
        },
        {
          ExtendedStatistics: {
            'p90.00': 2
          },
          Timestamp: 'Wed Dec 31 1969 16:05:00 GMT-0800 (PST)'
        },
        {
          ExtendedStatistics: {
            'p90.00': 5
          },
          Timestamp: 'Wed Dec 31 1969 16:15:00 GMT-0800 (PST)'
        }
      ],
      Label: 'TargetResponseTime'
    };

    beforeEach(function() {
      ctx.backendSrv.datasourceRequest = function(params) {
        requestParams = params;
        return ctx.$q.when({data: response});
      };
    });

    it('should return series list', function(done) {
      ctx.ds.query(query).then(function(result) {
        expect(result.data[0].target).to.be('TargetResponseTime_p90.00');
        expect(result.data[0].datapoints[0][0]).to.be(response.Datapoints[0].ExtendedStatistics['p90.00']);
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
            scenario.request = args;
            return ctx.$q.when({data: scenario.requestResponse });
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
      scenario.requestResponse = [{text: 'us-east-1'}];
    });

    it('should call __GetRegions and return result', () => {
      expect(scenario.result[0].text).to.contain('us-east-1');
      expect(scenario.request.data.action).to.be('__GetRegions');
    });
  });

  describeMetricFindQuery('namespaces()', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = [{text: 'AWS/EC2'}];
    });

    it('should call __GetNamespaces and return result', () => {
      expect(scenario.result[0].text).to.contain('AWS/EC2');
      expect(scenario.request.data.action).to.be('__GetNamespaces');
    });
  });

  describeMetricFindQuery('metrics(AWS/EC2)', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = [{text: 'CPUUtilization'}];
    });

    it('should call __GetMetrics and return result', () => {
      expect(scenario.result[0].text).to.be('CPUUtilization');
      expect(scenario.request.data.action).to.be('__GetMetrics');
    });
  });

  describeMetricFindQuery('dimension_keys(AWS/EC2)', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = [{text: 'InstanceId'}];
    });

    it('should call __GetDimensions and return result', () => {
      expect(scenario.result[0].text).to.be('InstanceId');
      expect(scenario.request.data.action).to.be('__GetDimensions');
    });
  });

  describeMetricFindQuery('dimension_values(us-east-1,AWS/EC2,CPUUtilization,InstanceId)', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        Metrics: [
          {
            Namespace: 'AWS/EC2',
            MetricName: 'CPUUtilization',
            Dimensions: [
              {
                Name: 'InstanceId',
                Value: 'i-12345678'
              }
            ]
          }
        ]
      };
    });

    it('should call __ListMetrics and return result', () => {
      expect(scenario.result[0].text).to.be('i-12345678');
      expect(scenario.request.data.action).to.be('ListMetrics');
    });
  });

  it('should caclculate the correct period', function () {
    var hourSec = 60 * 60;
    var daySec = hourSec * 24;
    var start = 1483196400;
    var testData: any[] = [
      [{ period: 60 }, { namespace: 'AWS/EC2' }, {}, start, start + 3600, (hourSec * 3), 60],
      [{ period: null }, { namespace: 'AWS/EC2' }, {}, start, start + 3600, (hourSec * 3), 300],
      [{ period: 60 }, { namespace: 'AWS/ELB' }, {}, start, start + 3600, (hourSec * 3), 60],
      [{ period: null }, { namespace: 'AWS/ELB' }, {}, start, start + 3600, (hourSec * 3), 60],
      [{ period: 1 }, { namespace: 'CustomMetricsNamespace' }, {}, start, start + 1440 - 1, (hourSec * 3 - 1), 1],
      [{ period: 1 }, { namespace: 'CustomMetricsNamespace' }, {}, start, start + 3600, (hourSec * 3 - 1), 60],
      [{ period: 60 }, { namespace: 'CustomMetricsNamespace' }, {}, start, start + 3600, (hourSec * 3), 60],
      [{ period: null }, { namespace: 'CustomMetricsNamespace' }, {}, start, start + 3600, (hourSec * 3 - 1), 60],
      [{ period: null }, { namespace: 'CustomMetricsNamespace' }, {}, start, start + 3600, (hourSec * 3), 60],
      [{ period: null }, { namespace: 'CustomMetricsNamespace' }, {}, start, start + 3600, (daySec * 15), 60],
      [{ period: null }, { namespace: 'CustomMetricsNamespace' }, {}, start, start + 3600, (daySec * 63), 300],
      [{ period: null }, { namespace: 'CustomMetricsNamespace' }, {}, start, start + 3600, (daySec * 455), 3600]
    ];
    for (let t of testData) {
      let target = t[0];
      let query = t[1];
      let options = t[2];
      let start = t[3];
      let end = t[4];
      let now = start + t[5];
      let expected = t[6];
      let actual = ctx.ds.getPeriod(target, query, options, start, end, now);
      expect(actual).to.be(expected);
    }
  });

  describeMetricFindQuery('ec2_instance_attribute(us-east-1, Tags.Name, { "tag:team": [ "sysops" ] })', scenario => {
    scenario.setup(() => {
      scenario.requestResponse = {
        Reservations: [
          {
            Instances: [
              {
                Tags: [
                  { Key: 'InstanceId', Value: 'i-123456' },
                  { Key: 'Name', Value: 'Sysops Dev Server' },
                  { Key: 'env', Value: 'dev' },
                  { Key: 'team', Value: 'sysops' }
                ]
              },
              {
                Tags: [
                  { Key: 'InstanceId', Value: 'i-789012' },
                  { Key: 'Name', Value: 'Sysops Staging Server' },
                  { Key: 'env', Value: 'staging' },
                  { Key: 'team', Value: 'sysops' }
                ]
              }
            ]
          }
        ]
      };
    });

    it('should return the "Name" tag for each instance', function() {
      expect(scenario.result[0].text).to.be('Sysops Dev Server');
      expect(scenario.result[1].text).to.be('Sysops Staging Server');
    });
  });

});
