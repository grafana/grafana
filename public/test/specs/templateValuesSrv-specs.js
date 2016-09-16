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

    describe('when template variable is present in url multiple times', function() {
      var variable = {
        name: 'apps',
        multi: true,
        current: {text: "val1", value: "val1"},
        options: [{text: "val1", value: "val1"}, {text: 'val2', value: 'val2'}, {text: 'val3', value: 'val3', selected: true}]
      };

      beforeEach(function(done) {
        var dashboard = { templating: { list: [variable] } };
        var urlParams = {};
        urlParams["var-apps"] = ["val2", "val1"];
        ctx.$location.search = sinon.stub().returns(urlParams);
        ctx.service.init(dashboard).then(function() { done(); });
        ctx.$rootScope.$digest();
      });

      it('should update current value', function() {
        expect(variable.current.value.length).to.be(2);
        expect(variable.current.value[0]).to.be("val2");
        expect(variable.current.value[1]).to.be("val1");
        expect(variable.current.text).to.be("val2 + val1");
        expect(variable.options[0].selected).to.be(true);
        expect(variable.options[1].selected).to.be(true);
      });

      it('should set options that are not in value to selected false', function() {
        expect(variable.options[2].selected).to.be(false);
      });
    });


  });
});
