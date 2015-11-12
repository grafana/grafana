///<amd-dependency path="app/plugins/datasource/influxdb_08/datasource"/>
///<amd-dependency path="app/services/backendSrv"/>
///<amd-dependency path="app/services/alertSrv"/>
///<amd-dependency path="test/specs/helpers" name="helpers" />

import {describe, beforeEach, it, sinon, expect, angularMocks} from 'test/lib/common';

declare var helpers: any;

describe('InfluxDatasource', function() {
  var ctx = new helpers.ServiceTestContext();

  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(ctx.providePhase(['templateSrv']));
  beforeEach(ctx.createService('InfluxDatasource_08'));
  beforeEach(function() {
    ctx.ds = new ctx.service({ url: '', user: 'test', password: 'mupp' });
  });

  describe('When querying influxdb with one target using query editor target spec', function() {
    var results;
    var urlExpected = "/series?p=mupp&q=select+mean(value)+from+%22test%22+where+time+%3E+now()-1h+group+by+time(1s)+order+asc";
    var query = {
      rangeRaw: { from: 'now-1h', to: 'now' },
      targets: [{ series: 'test', column: 'value', function: 'mean' }],
      interval: '1s'
    };

    var response = [{
      columns: ["time", "sequence_nr", "value"],
      name: 'test',
      points: [[10, 1, 1]],
    }];

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
      expect(results.data[0].target).to.be('test.value');
    });

  });

  describe('When querying influxdb with one raw query', function() {
    var results;
    var urlExpected = "/series?p=mupp&q=select+value+from+series+where+time+%3E+now()-1h";
    var query = {
      rangeRaw: { from: 'now-1h', to: 'now' },
      targets: [{ query: "select value from series where $timeFilter", rawQuery: true }]
    };

    var response = [];

    beforeEach(function() {
      ctx.$httpBackend.expect('GET', urlExpected).respond(response);
      ctx.ds.query(query).then(function(data) { results = data; });
      ctx.$httpBackend.flush();
    });

    it('should generate the correct query', function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });

  });

  describe('When issuing annotation query', function() {
    var results;
    var urlExpected = "/series?p=mupp&q=select+title+from+events.backend_01+where+time+%3E+now()-1h";

    var range = { from: 'now-1h', to: 'now' };
    var annotation = { query: 'select title from events.$server where $timeFilter' };
    var response = [];

    beforeEach(function() {
      ctx.templateSrv.replace = function(str) {
        return str.replace('$server', 'backend_01');
      };
      ctx.$httpBackend.expect('GET', urlExpected).respond(response);
      ctx.ds.annotationQuery({annotation: annotation, rangeRaw: range}).then(function(data) { results = data; });
      ctx.$httpBackend.flush();
    });

    it('should generate the correct query', function() {
      ctx.$httpBackend.verifyNoOutstandingExpectation();
    });

  });

});
