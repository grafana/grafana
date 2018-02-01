import { describe, beforeEach, it, expect, angularMocks } from 'test/lib/common';
import helpers from 'test/specs/helpers';
import OpenTsDatasource from '../datasource';

describe('opentsdb', function() {
  var ctx = new helpers.ServiceTestContext();
  var instanceSettings = { url: '', jsonData: { tsdbVersion: 1 } };

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(ctx.providePhase(['backendSrv']));

  beforeEach(
    angularMocks.inject(function($q, $rootScope, $httpBackend, $injector) {
      ctx.$q = $q;
      ctx.$httpBackend = $httpBackend;
      ctx.$rootScope = $rootScope;
      ctx.ds = $injector.instantiate(OpenTsDatasource, {
        instanceSettings: instanceSettings,
      });
      $httpBackend.when('GET', /\.html$/).respond('');
    })
  );

  describe('When performing metricFindQuery', function() {
    var results;
    var requestOptions;

    beforeEach(function() {
      ctx.backendSrv.datasourceRequest = function(options) {
        requestOptions = options;
        return ctx.$q.when({
          data: [{ target: 'prod1.count', datapoints: [[10, 1], [12, 1]] }],
        });
      };
    });

    it('metrics() should generate api suggest query', function() {
      ctx.ds.metricFindQuery('metrics(pew)').then(function(data) {
        results = data;
      });
      ctx.$rootScope.$apply();
      expect(requestOptions.url).to.be('/api/suggest');
      expect(requestOptions.params.type).to.be('metrics');
      expect(requestOptions.params.q).to.be('pew');
      expect(results).not.to.be(null);
    });

    it('tag_names(cpu) should generate lookup query', function() {
      ctx.ds.metricFindQuery('tag_names(cpu)').then(function(data) {
        results = data;
      });
      ctx.$rootScope.$apply();
      expect(requestOptions.url).to.be('/api/search/lookup');
      expect(requestOptions.params.m).to.be('cpu');
    });

    it('tag_values(cpu, test) should generate lookup query', function() {
      ctx.ds.metricFindQuery('tag_values(cpu, hostname)').then(function(data) {
        results = data;
      });
      ctx.$rootScope.$apply();
      expect(requestOptions.url).to.be('/api/search/lookup');
      expect(requestOptions.params.m).to.be('cpu{hostname=*}');
    });

    it('tag_values(cpu, test) should generate lookup query', function() {
      ctx.ds.metricFindQuery('tag_values(cpu, hostname, env=$env)').then(function(data) {
        results = data;
      });
      ctx.$rootScope.$apply();
      expect(requestOptions.url).to.be('/api/search/lookup');
      expect(requestOptions.params.m).to.be('cpu{hostname=*,env=$env}');
    });

    it('tag_values(cpu, test) should generate lookup query', function() {
      ctx.ds.metricFindQuery('tag_values(cpu, hostname, env=$env, region=$region)').then(function(data) {
        results = data;
      });
      ctx.$rootScope.$apply();
      expect(requestOptions.url).to.be('/api/search/lookup');
      expect(requestOptions.params.m).to.be('cpu{hostname=*,env=$env,region=$region}');
    });

    it('suggest_tagk() should generate api suggest query', function() {
      ctx.ds.metricFindQuery('suggest_tagk(foo)').then(function(data) {
        results = data;
      });
      ctx.$rootScope.$apply();
      expect(requestOptions.url).to.be('/api/suggest');
      expect(requestOptions.params.type).to.be('tagk');
      expect(requestOptions.params.q).to.be('foo');
    });

    it('suggest_tagv() should generate api suggest query', function() {
      ctx.ds.metricFindQuery('suggest_tagv(bar)').then(function(data) {
        results = data;
      });
      ctx.$rootScope.$apply();
      expect(requestOptions.url).to.be('/api/suggest');
      expect(requestOptions.params.type).to.be('tagv');
      expect(requestOptions.params.q).to.be('bar');
    });
  });
});
