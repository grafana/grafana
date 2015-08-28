define([
  'helpers',
  'plugins/datasource/opennms/datasource'
], function (helpers) {
  'use strict';

  describe('OpenNMSDatasource', function () {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['templateSrv']));
    beforeEach(ctx.createService('OpenNMSDatasource'));
    beforeEach(function () {
      ctx.ds = new ctx.service({url: [''], user: 'test', password: 'mupp'});
    });

    describe('When querying OpenNMS with one target', function () {
      var results;

      var query = {
        range: {from: 'now-1h', to: 'now'},
        targets: [{type:"attribute", nodeId: '1', resourceId: 'nodeSnmp[]', attribute: 'loadavg1', aggregation: 'AVERAGE'}],
        interval: '1s'
      };

      var urlExpected = "/rest/measurements";
      var response = {
        "step": 300000,
        "start": 1424211730000,
        "end": 1424226130000,
        "timestamps": [1424211730001],
        "labels": ["loadavg1"],
        "columns": [
          {
            "values": [5.0]
          }
        ]
      };

      beforeEach(function () {
        ctx.$httpBackend.expect('POST', urlExpected).respond(response);
        ctx.ds.query(query).then(function (data) {
          results = data;
        });
        ctx.$httpBackend.flush();
      });

      it('should generate the correct query', function () {
        ctx.$httpBackend.verifyNoOutstandingExpectation();
      });

      it('should return series list', function () {
        expect(results.data.length).to.be(1);
        expect(results.data[0].target).to.be('loadavg1');
        expect(results.data[0].datapoints.length).to.be(1);
      });

    });

  });

});