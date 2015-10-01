///<amd-dependency path="app/plugins/datasource/cloudwatch/datasource" />
///<amd-dependency path="test/specs/helpers" name="helpers" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

declare var helpers: any;

describe('CloudWatchDatasource', function() {
  var ctx = new helpers.ServiceTestContext();

  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(angularMocks.module('grafana.controllers'));
<<<<<<< d59a1575c0293e7357b0d49889067926267e31a0
  beforeEach(ctx.providePhase(['templateSrv', 'backendSrv']));
=======
  beforeEach(ctx.providePhase(['templateSrv']));
>>>>>>> feat(cloudwatch): moved specs into plugins dir
  beforeEach(ctx.createService('CloudWatchDatasource'));
  beforeEach(function() {
    ctx.ds = new ctx.service({
      jsonData: {
        defaultRegion: 'us-east-1',
        access: 'proxy'
      }
    });
  });

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
<<<<<<< d59a1575c0293e7357b0d49889067926267e31a0
          statistics: ['Average'],
=======
          statistics: {
            Average: true
          },
>>>>>>> feat(cloudwatch): moved specs into plugins dir
          period: 300
        }
      ]
    };

    var response = {
      Datapoints: [
        {
          Average: 1,
          Timestamp: 'Wed Dec 31 1969 16:00:00 GMT-0800 (PST)'
        }
      ],
      Label: 'CPUUtilization'
    };

    beforeEach(function() {
<<<<<<< d59a1575c0293e7357b0d49889067926267e31a0
      ctx.backendSrv.datasourceRequest = function(params) {
        requestParams = params;
        return ctx.$q.when({data: response});
=======
      ctx.ds.getAwsClient = function() {
        return {
          getMetricStatistics: function(params, callback) {
            requestParams = params;
            callback(null, response);
          }
        };
>>>>>>> feat(cloudwatch): moved specs into plugins dir
      };
    });

    it('should generate the correct query', function(done) {
      ctx.ds.query(query).then(function() {
<<<<<<< d59a1575c0293e7357b0d49889067926267e31a0
        var params = requestParams.data.parameters;
        expect(params.namespace).to.be(query.targets[0].namespace);
        expect(params.metricName).to.be(query.targets[0].metricName);
        expect(params.dimensions[0].Name).to.be(Object.keys(query.targets[0].dimensions)[0]);
        expect(params.dimensions[0].Value).to.be(query.targets[0].dimensions[Object.keys(query.targets[0].dimensions)[0]]);
        expect(params.statistics).to.eql(query.targets[0].statistics);
        expect(params.period).to.be(query.targets[0].period);
=======
        expect(requestParams.Namespace).to.be(query.targets[0].namespace);
        expect(requestParams.MetricName).to.be(query.targets[0].metricName);
        expect(requestParams.Dimensions[0].Name).to.be(Object.keys(query.targets[0].dimensions)[0]);
        expect(requestParams.Dimensions[0].Value).to.be(query.targets[0].dimensions[Object.keys(query.targets[0].dimensions)[0]]);
        expect(requestParams.Statistics).to.eql(Object.keys(query.targets[0].statistics));
        expect(requestParams.Period).to.be(query.targets[0].period);
>>>>>>> feat(cloudwatch): moved specs into plugins dir
        done();
      });
      ctx.$rootScope.$apply();
    });

    it('should return series list', function(done) {
      ctx.ds.query(query).then(function(result) {
<<<<<<< d59a1575c0293e7357b0d49889067926267e31a0
        expect(result.data[0].target).to.be('CPUUtilization_Average');
        expect(result.data[0].datapoints[0][0]).to.be(response.Datapoints[0]['Average']);
=======
        var s = Object.keys(query.targets[0].statistics)[0];
        expect(result.data[0].target).to.be(response.Label + '_' + s + JSON.stringify(query.targets[0].dimensions));
        expect(result.data[0].datapoints[0][0]).to.be(response.Datapoints[0][s]);
>>>>>>> feat(cloudwatch): moved specs into plugins dir
        done();
      });
      ctx.$rootScope.$apply();
    });
  });

<<<<<<< d59a1575c0293e7357b0d49889067926267e31a0
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

  describeMetricFindQuery('dimension_values(us-east-1,AWS/EC2,CPUUtilization)', scenario => {
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

=======
  describe('When performing CloudWatch metricFindQuery', function() {
    var requestParams;

    var response = {
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

    beforeEach(function() {
      ctx.ds.getAwsClient = function() {
        return {
          listMetrics: function(params, callback) {
            requestParams = params;
            callback(null, response);
          }
        };
      };
    });

    it('should return suggest list for region()', function(done) {
      var query = 'region()';
      ctx.ds.metricFindQuery(query).then(function(result) {
        result = result.map(function(v) { return v.text; });
        expect(result).to.contain('us-east-1');
        done();
      });
      ctx.$rootScope.$apply();
    });

    it('should return suggest list for namespace()', function(done) {
      var query = 'namespace()';
      ctx.ds.metricFindQuery(query).then(function(result) {
        result = result.map(function(v) { return v.text; });
        expect(result).to.contain('AWS/EC2');
        done();
      });
      ctx.$rootScope.$apply();
    });

    it('should return suggest list for metrics()', function(done) {
      var query = 'metrics(AWS/EC2)';
      ctx.ds.metricFindQuery(query).then(function(result) {
        result = result.map(function(v) { return v.text; });
        expect(result).to.contain('CPUUtilization');
        done();
      });
      ctx.$rootScope.$apply();
    });

    it('should return suggest list for dimension_keys()', function(done) {
      var query = 'dimension_keys(AWS/EC2)';
      ctx.ds.metricFindQuery(query).then(function(result) {
        result = result.map(function(v) { return v.text; });
        expect(result).to.contain('InstanceId');
        done();
      });
      ctx.$rootScope.$apply();
    });

    it('should return suggest list for dimension_values()', function(done) {
      var query = 'dimension_values(us-east-1,AWS/EC2,CPUUtilization)';
      ctx.ds.metricFindQuery(query).then(function(result) {
        result = result.map(function(v) { return v.text; });
        expect(result).to.eql(['InstanceId=i-12345678']);
        done();
      });
      ctx.$rootScope.$apply();
    });
  });
>>>>>>> feat(cloudwatch): moved specs into plugins dir
});
