///<amd-dependency path="app/plugins/datasource/cloudwatch/datasource" />
///<amd-dependency path="test/specs/helpers" name="helpers" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

declare var helpers: any;

describe('CloudWatchDatasource', function() {
  var ctx = new helpers.ServiceTestContext();

  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(angularMocks.module('grafana.controllers'));
  beforeEach(ctx.providePhase(['templateSrv']));
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
          statistics: {
            Average: true
          },
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
      ctx.ds.getAwsClient = function() {
        return {
          getMetricStatistics: function(params) {
            requestParams = params;
            return ctx.$q.when(response);
          }
        };
      };
    });

    it('should generate the correct query', function(done) {
      ctx.ds.query(query).then(function() {
        expect(requestParams.Namespace).to.be(query.targets[0].namespace);
        expect(requestParams.MetricName).to.be(query.targets[0].metricName);
        expect(requestParams.Dimensions[0].Name).to.be(Object.keys(query.targets[0].dimensions)[0]);
        expect(requestParams.Dimensions[0].Value).to.be(query.targets[0].dimensions[Object.keys(query.targets[0].dimensions)[0]]);
        expect(requestParams.Statistics).to.eql(Object.keys(query.targets[0].statistics));
        expect(requestParams.Period).to.be(query.targets[0].period);
        done();
      });
      ctx.$rootScope.$apply();
    });

    it('should return series list', function(done) {
      ctx.ds.query(query).then(function(result) {
        var s = Object.keys(query.targets[0].statistics)[0];
        expect(result.data[0].target).to.be(response.Label + '_' + s + JSON.stringify(query.targets[0].dimensions));
        expect(result.data[0].datapoints[0][0]).to.be(response.Datapoints[0][s]);
        done();
      });
      ctx.$rootScope.$apply();
    });
  });

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
          listMetrics: function(params) {
            requestParams = params;
            return ctx.$q.when(response);
          }
        };
      };
    });

    it('should return suggest list for region()', function(done) {
      var query = 'region()';
      ctx.ds.metricFindQuery(query).then(function(result) {
        expect(result[0].text).to.contain('us-east-1');
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
});
