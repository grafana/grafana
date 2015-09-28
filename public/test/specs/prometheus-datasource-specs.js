define([
  './helpers',
  'moment',
  'app/plugins/datasource/prometheus/datasource',
  'app/services/backendSrv',
  'app/services/alertSrv'
], function(helpers, moment) {
  'use strict';

  describe('PrometheusDatasource', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['templateSrv']));
    beforeEach(ctx.createService('PrometheusDatasource'));
    beforeEach(function() {
      ctx.ds = new ctx.service({ url: '', user: 'test', password: 'mupp' });
    });

    describe('When querying prometheus with one target using query editor target spec', function() {
      var results;
      var urlExpected = '/api/v1/query_range?query=' +
                        encodeURIComponent('test{job="testjob"}') +
                        '&start=1443438675&end=1443460275&step=60s';
      var query = {
        range: { from: moment(1443438674760), to: moment(1443460274760) },
        targets: [{ expr: 'test{job="testjob"}' }],
        interval: '60s'
      };

      var response = {
        "status":"success",
        "data":{
          "resultType":"matrix",
          "result":[{
            "metric":{"__name__":"test", "job":"testjob"},
            "values":[[1443454528,"3846"]]
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

  });
});

