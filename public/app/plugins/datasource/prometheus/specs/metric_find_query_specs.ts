import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';
import moment from 'moment';
import helpers from 'test/specs/helpers';
import {PrometheusDatasource} from '../datasource';
import PrometheusMetricFindQuery from '../metric_find_query';

describe('PrometheusMetricFindQuery', function() {

  var ctx = new helpers.ServiceTestContext();
  var instanceSettings = {url: 'proxied', directUrl: 'direct', user: 'test', password: 'mupp' };

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(angularMocks.inject(function($q, $rootScope, $httpBackend, $injector) {
    ctx.$q = $q;
    ctx.$httpBackend =  $httpBackend;
    ctx.$rootScope = $rootScope;
    ctx.ds = $injector.instantiate(PrometheusDatasource, {instanceSettings: instanceSettings});
    $httpBackend.when('GET', /\.html$/).respond('');
  }));

  describe('When performing metricFindQuery', function() {
    var results;
    var response;
    it('label_values(resource) should generate label search query', function() {
      response = {
        status: "success",
        data: ["value1", "value2", "value3"]
      };
      ctx.$httpBackend.expect('GET', 'proxied/api/v1/label/resource/values').respond(response);
      var pm = new PrometheusMetricFindQuery(ctx.ds, 'label_values(resource)', ctx.timeSrv);
      pm.process().then(function(data) { results = data; });
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
      ctx.$httpBackend.expect('GET', /proxied\/api\/v1\/series\?match\[\]=metric&start=.*&end=.*/).respond(response);
      var pm = new PrometheusMetricFindQuery(ctx.ds, 'label_values(metric, resource)', ctx.timeSrv);
      pm.process().then(function(data) { results = data; });
      ctx.$httpBackend.flush();
      ctx.$rootScope.$apply();
      expect(results.length).to.be(3);
    });
    it('label_values(metric, resource) should pass correct time', function() {
      ctx.timeSrv.setTime({ from: moment.utc('2011-01-01'), to: moment.utc('2015-01-01') });
      ctx.$httpBackend.expect('GET',
        /proxied\/api\/v1\/series\?match\[\]=metric&start=1293840000&end=1420070400/).respond(response);
      var pm = new PrometheusMetricFindQuery(ctx.ds, 'label_values(metric, resource)', ctx.timeSrv);
      pm.process().then(function(data) { results = data; });
      ctx.$httpBackend.flush();
      ctx.$rootScope.$apply();
    });
    it('label_values(metric{label1="foo", label2="bar", label3="baz"}, resource) should generate series query', function() {
      response = {
        status: "success",
        data: [
          {__name__: "metric", resource: "value1"},
          {__name__: "metric", resource: "value2"},
          {__name__: "metric", resource: "value3"}
        ]
      };
      ctx.$httpBackend.expect('GET', /proxied\/api\/v1\/series\?match\[\]=metric&start=.*&end=.*/).respond(response);
      var pm = new PrometheusMetricFindQuery(ctx.ds, 'label_values(metric, resource)', ctx.timeSrv);
      pm.process().then(function(data) { results = data; });
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
      var pm = new PrometheusMetricFindQuery(ctx.ds, 'metrics(metric.*)', ctx.timeSrv);
      pm.process().then(function(data) { results = data; });
      ctx.$httpBackend.flush();
      ctx.$rootScope.$apply();
      expect(results.length).to.be(3);
    });
    it('query_result(metric) should generate metric name query', function() {
      response = {
        status: "success",
        data: {
          resultType: "vector",
          result: [{
            metric: {"__name__": "metric", job: "testjob"},
            value: [1443454528.000, "3846"]
          }]
        }
      };
      ctx.$httpBackend.expect('GET', /proxied\/api\/v1\/query\?query=metric&time=.*/).respond(response);
      var pm = new PrometheusMetricFindQuery(ctx.ds, 'query_result(metric)', ctx.timeSrv);
      pm.process().then(function(data) { results = data; });
      ctx.$httpBackend.flush();
      ctx.$rootScope.$apply();
      expect(results.length).to.be(1);
      expect(results[0].text).to.be('metric{job="testjob"} 3846 1443454528000');
    });
  });

  describe('When performing performSuggestQuery', function() {
    var results;
    var response;
    it('cache response', function() {
      response = {
        status: "success",
        data: ["value1", "value2", "value3"]
      };
      ctx.$httpBackend.expect('GET', 'proxied/api/v1/label/__name__/values').respond(response);
      ctx.ds.performSuggestQuery('value', true).then(function(data) { results = data; });
      ctx.$httpBackend.flush();
      ctx.$rootScope.$apply();
      expect(results.length).to.be(3);
      ctx.ds.performSuggestQuery('value', true).then(function (data) {
        // get from cache, no need to flush
        results = data;
        expect(results.length).to.be(3);
      });
    });
  });
});
