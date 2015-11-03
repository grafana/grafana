define([
  './helpers',
  'app/plugins/datasource/opentsdb/datasource'
], function(helpers) {
  'use strict';

  describe('opentsdb', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['backendSrv']));

    beforeEach(ctx.createService('OpenTSDBDatasource'));
    beforeEach(function() {
      ctx.ds = new ctx.service({ url: [''], jsonData: {} });
    });

    describe('When performing metricFindQuery', function() {
      var results;
      var requestOptions;

      beforeEach(function() {
        ctx.backendSrv.datasourceRequest = function(options) {
          requestOptions = options;
          return ctx.$q.when({data: [{ target: 'prod1.count', datapoints: [[10, 1], [12,1]] }]});
        };
      });

      it('metrics() should generate api suggest query', function() {
        ctx.ds.metricFindQuery('metrics(pew)').then(function(data) { results = data; });
        ctx.$rootScope.$apply();
        expect(requestOptions.url).to.be('/api/suggest');
        expect(requestOptions.params.type).to.be('metrics');
        expect(requestOptions.params.q).to.be('pew');
      });

      it('tag_names(cpu) should generate looku  query', function() {
        ctx.ds.metricFindQuery('tag_names(cpu)').then(function(data) { results = data; });
        ctx.$rootScope.$apply();
        expect(requestOptions.url).to.be('/api/search/lookup');
        expect(requestOptions.params.m).to.be('cpu');
      });

      it('tag_values(cpu, test) should generate looku  query', function() {
        ctx.ds.metricFindQuery('tag_values(cpu, hostname)').then(function(data) { results = data; });
        ctx.$rootScope.$apply();
        expect(requestOptions.url).to.be('/api/search/lookup');
        expect(requestOptions.params.m).to.be('cpu{hostname=*}');
      });

      it('suggest_tagk() should generate api suggest query', function() {
        ctx.ds.metricFindQuery('suggest_tagk(foo)').then(function(data) { results = data; });
        ctx.$rootScope.$apply();
        expect(requestOptions.url).to.be('/api/suggest');
        expect(requestOptions.params.type).to.be('tagk');
        expect(requestOptions.params.q).to.be('foo');
      });

      it('suggest_tagv() should generate api suggest query', function() {
        ctx.ds.metricFindQuery('suggest_tagv(bar)').then(function(data) { results = data; });
        ctx.$rootScope.$apply();
        expect(requestOptions.url).to.be('/api/suggest');
        expect(requestOptions.params.type).to.be('tagv');
        expect(requestOptions.params.q).to.be('bar');
      });

    });
  });
});

