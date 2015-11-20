///<amd-dependency path="../datasource" />
///<amd-dependency path="test/specs/helpers" name="helpers" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';
import moment  = require('moment');
import angular = require('angular');

declare var helpers: any;

describe('ElasticDatasource', function() {
  var ctx = new helpers.ServiceTestContext();

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(ctx.providePhase(['templateSrv', 'backendSrv']));
  beforeEach(ctx.createService('ElasticDatasource'));
  beforeEach(function() {
    ctx.ds = new ctx.service({jsonData: {}});
  });

  describe('When testing datasource with index pattern', function() {
    beforeEach(function() {
      ctx.ds = new ctx.service({
        url: 'http://es.com',
        index: '[asd-]YYYY.MM.DD',
        jsonData: { interval: 'Daily' }
      });
    });

    it('should translate index pattern to current day', function() {
      var requestOptions;
      ctx.backendSrv.datasourceRequest = function(options) {
        requestOptions = options;
        return ctx.$q.when({});
      };

      ctx.ds.testDatasource();
      ctx.$rootScope.$apply();

      var today = moment.utc().format("YYYY.MM.DD");
      expect(requestOptions.url).to.be("http://es.com/asd-" + today + '/_stats');
    });
  });

  describe('When issueing metric query with interval pattern', function() {
    var requestOptions, parts, header;

    beforeEach(function() {
      ctx.ds = new ctx.service({
        url: 'http://es.com',
        index: '[asd-]YYYY.MM.DD',
        jsonData: { interval: 'Daily' }
      });

      ctx.backendSrv.datasourceRequest = function(options) {
        requestOptions = options;
        return ctx.$q.when({data: {responses: []}});
      };

      ctx.ds.query({
        range: {
          from: moment([2015, 4, 30, 10]),
          to: moment([2015, 5, 1, 10])
        },
        targets: [{ bucketAggs: [], metrics: [], query: 'escape\\:test' }]
      });

      ctx.$rootScope.$apply();

      parts = requestOptions.data.split('\n');
      header = angular.fromJson(parts[0]);
    });

    it('should translate index pattern to current day', function() {
      expect(header.index).to.eql(['asd-2015.05.30', 'asd-2015.05.31', 'asd-2015.06.01']);
    });

    it('should json escape lucene query', function() {
      var body = angular.fromJson(parts[1]);
      expect(body.query.filtered.query.query_string.query).to.be('escape\\:test');
    });
  });

  describe('When issueing document query', function() {
    var requestOptions, parts, header;

    beforeEach(function() {
      ctx.ds = new ctx.service({url: 'http://es.com', index: 'test', jsonData: {}});

      ctx.backendSrv.datasourceRequest = function(options) {
        requestOptions = options;
        return ctx.$q.when({data: {responses: []}});
      };

      ctx.ds.query({
        range: { from: moment([2015, 4, 30, 10]), to: moment([2015, 5, 1, 10]) },
        targets: [{ bucketAggs: [], metrics: [{type: 'raw_document'}], query: 'test' }]
      });

      ctx.$rootScope.$apply();
      parts = requestOptions.data.split('\n');
      header = angular.fromJson(parts[0]);
    });

    it('should set search type to query_then_fetch', function() {
      expect(header.search_type).to.eql('query_then_fetch');
    });

    it('should set size', function() {
      var body = angular.fromJson(parts[1]);
      expect(body.size).to.be(500);
    });
  });

  describe('When issuing id mapping query', function() {
    var requestOptions;
    var esReply = { data: { hits: { hits: [{ _source: { idfield: "id1", namefield: "name1" } }] } } };
    var result;
    beforeEach(function() {
      ctx.ds = new ctx.service({
        url: 'http://es.com',
        index: 'idmap',
        jsonData: { interval: 'Daily' }
      });

      ctx.backendSrv.datasourceRequest = function(options) {
        requestOptions = options;
        return ctx.$q.when(esReply);
      };

      ctx.ds.mapIdQuery('id1', 'idfield', 'namefield').then(function(r) {
        result = r;
      });

      ctx.$rootScope.$apply();
    });

    it('should query the search URL', function() {
      expect(requestOptions.url).to.be("http://es.com/idmap/_search");
    });

    it('should send query for the requested id and idfield', function() {
      expect(requestOptions.data).to.eql({
        query: { bool: { should: [{ query_string: { query: 'idfield:id1' } }] } },
        size: 1
      });
    });

    it('should return the correct name for the id based on the specified namefield', function() {
      expect(result).to.be("name1");
    });
  });
});
