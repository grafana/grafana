define([
  '../mocks/dashboard-mock',
  './helpers',
  'app/features/templating/templateValuesSrv'
], function(dashboardMock, helpers) {
  'use strict';

  describe('templateValuesSrv', function() {
    var ctx = new helpers.ServiceTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase(['datasourceSrv', 'timeSrv', 'templateSrv', '$location']));
    beforeEach(ctx.createService('templateValuesSrv'));

    describe('when template variable is present in url', function() {
      describe('and setting simple variable', function() {
        var variable = {
          name: 'apps',
          current: {text: "test", value: "test"},
          options: [{text: "test", value: "test"}]
        };

        beforeEach(function(done) {
          var dashboard = { templating: { list: [variable] } };
          var urlParams = {};
          urlParams["var-apps"] = "new";
          ctx.$location.search = sinon.stub().returns(urlParams);
          ctx.service.init(dashboard).then(function() { done(); });
          ctx.$rootScope.$digest();
        });

        it('should update current value', function() {
          expect(variable.current.value).to.be("new");
          expect(variable.current.text).to.be("new");
        });
      });

      // describe('and setting adhoc variable', function() {
      //   var variable = {name: 'filters', type: 'adhoc'};
      //
      //   beforeEach(function(done) {
      //     var dashboard = { templating: { list: [variable] } };
      //     var urlParams = {};
      //     urlParams["var-filters"] = "hostname|gt|server2";
      //     ctx.$location.search = sinon.stub().returns(urlParams);
      //     ctx.service.init(dashboard).then(function() { done(); });
      //     ctx.$rootScope.$digest();
      //   });
      //
      //   it('should update current value', function() {
      //     expect(variable.tags[0]).to.eq({tag: 'hostname', value: 'server2'});
      //   });
      // });
    });


  });
});
