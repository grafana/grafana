import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';
import moment from 'moment';
import helpers from 'test/specs/helpers';
import Datasource from '../datasource';

describe('PrometheusDatasource', function() {
  var ctx = new helpers.ServiceTestContext();
  var instanceSettings = {url: 'proxied', directUrl: 'direct', user: 'test', password: 'mupp' };

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(angularMocks.inject(function($q, $rootScope, $httpBackend, $injector) {
    ctx.$q = $q;
    ctx.$httpBackend =  $httpBackend;
    ctx.$rootScope = $rootScope;
    ctx.ds = $injector.instantiate(Datasource, {instanceSettings: instanceSettings});
  }));

  describe('When querying prometheus with one target using query editor target spec', function() {
    var results;
    var urlExpected = 'proxied/api/v1/query_range?query=' +
                      encodeURIComponent('test{job="testjob"}') +
                      '&start=1443438675&end=1443460275&step=60';
    var query = {
      range: { from: moment(1443438674760), to: moment(1443460274760) },
      targets: [{ expr: 'test{job="testjob"}' }],
      interval: '60s'
    };
    var response = {
      status: "success",
      data: {
        resultType: "matrix",
        result: [{
          metric: {"__name__": "test", job: "testjob"},
          values: [[1443454528, "3846"]]
        }]
      }
    };
    beforeEach(function() {
      ctx.$httpBackend.expect('GET', urlExpected).respond(response);
      ctx.ds.query(query).then(function(data) { results = data; });
      ctx.$httpBackend.flush();
    });
    it('should generate the correct query', function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });
    it('should return series list', function() {
      expect(results.data.length).to.be(1);
      expect(results.data[0].target).to.be('test{job="testjob"}');
    });
  });
  describe('When querying prometheus with one target which return multiple series', function() {
    var results;
    var start = 1443438675;
    var end = 1443460275;
    var step = 60;
    var urlExpected = 'proxied/api/v1/query_range?query=' +
                      encodeURIComponent('test{job="testjob"}') +
                      '&start=' + start + '&end=' + end + '&step=' + step;
    var query = {
      range: { from: moment(1443438674760), to: moment(1443460274760) },
      targets: [{ expr: 'test{job="testjob"}' }],
      interval: '60s'
    };
    var response = {
      status: "success",
      data: {
        resultType: "matrix",
        result: [
          {
            metric: {"__name__": "test", job: "testjob", series: 'series 1'},
            values: [
              [start + step * 1, "3846"],
              [start + step * 3, "3847"],
              [end - step * 1, "3848"],
            ]
          },
          {
            metric: {"__name__": "test", job: "testjob", series: 'series 2'},
            values: [
              [start + step * 2, "4846"]
            ]
          },
        ]
      }
    };
    beforeEach(function() {
      ctx.$httpBackend.expect('GET', urlExpected).respond(response);
      ctx.ds.query(query).then(function(data) { results = data; });
      ctx.$httpBackend.flush();
    });
    it('should be same length', function() {
      expect(results.data.length).to.be(2);
      expect(results.data[0].datapoints.length).to.be((end - start) / step + 1);
      expect(results.data[1].datapoints.length).to.be((end - start) / step + 1);
    });
    it('should fill null until first datapoint in response', function() {
      expect(results.data[0].datapoints[0][1]).to.be(start * 1000);
      expect(results.data[0].datapoints[0][0]).to.be(null);
      expect(results.data[0].datapoints[1][1]).to.be((start + step * 1) * 1000);
      expect(results.data[0].datapoints[1][0]).to.be(3846);
    });
    it('should fill null after last datapoint in response', function() {
      var length = (end - start) / step + 1;
      expect(results.data[0].datapoints[length-2][1]).to.be((end - step * 1) * 1000);
      expect(results.data[0].datapoints[length-2][0]).to.be(3848);
      expect(results.data[0].datapoints[length-1][1]).to.be(end * 1000);
      expect(results.data[0].datapoints[length-1][0]).to.be(null);
    });
    it('should fill null at gap between series', function() {
      expect(results.data[0].datapoints[2][1]).to.be((start + step * 2) * 1000);
      expect(results.data[0].datapoints[2][0]).to.be(null);
      expect(results.data[1].datapoints[1][1]).to.be((start + step * 1) * 1000);
      expect(results.data[1].datapoints[1][0]).to.be(null);
      expect(results.data[1].datapoints[3][1]).to.be((start + step * 3) * 1000);
      expect(results.data[1].datapoints[3][0]).to.be(null);
    });
  });
  describe('When performing metricFindQuery', function() {
    var results;
    var response;
    it('label_values(resource) should generate label search query', function() {
      response = {
        status: "success",
        data: ["value1", "value2", "value3"]
      };
      ctx.$httpBackend.expect('GET', 'proxied/api/v1/label/resource/values').respond(response);
      ctx.ds.metricFindQuery('label_values(resource)').then(function(data) { results = data; });
      ctx.$httpBackend.flush();
      ctx.$rootScope.$apply();
      expect(results.length).to.be(3);
    });
    it('label_values(metric, resource) should generate series query', function() {
      response = {
        status: "success",
        data: [
          {__name__: "metric", resource: "value1"},
          {__name__: "metric", resource: "value2"},
          {__name__: "metric", resource: "value3"}
        ]
      };
      ctx.$httpBackend.expect('GET', 'proxied/api/v1/series?match[]=metric').respond(response);
      ctx.ds.metricFindQuery('label_values(metric, resource)').then(function(data) { results = data; });
      ctx.$httpBackend.flush();
      ctx.$rootScope.$apply();
      expect(results.length).to.be(3);
    });
    it('metrics(metric.*) should generate metric name query', function() {
      response = {
        status: "success",
        data: ["metric1","metric2","metric3","nomatch"]
      };
      ctx.$httpBackend.expect('GET', 'proxied/api/v1/label/__name__/values').respond(response);
      ctx.ds.metricFindQuery('metrics(metric.*)').then(function(data) { results = data; });
      ctx.$httpBackend.flush();
      ctx.$rootScope.$apply();
      expect(results.length).to.be(3);
    });
  });
});
