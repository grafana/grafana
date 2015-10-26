///<amd-dependency path="../datasource" />
///<amd-dependency path="test/specs/helpers" name="helpers" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';
import moment  = require('moment');
import angular = require('angular');

declare var helpers: any;

describe('ElasticDatasource', function() {
  var ctx = new helpers.ServiceTestContext();

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
});
