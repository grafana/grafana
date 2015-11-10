define([
  './helpers',
  'app/features/dashboard/dashboardCtrl',
], function(helpers) {
  'use strict';

  describe('DashboardCtrl', function () {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.controllers'));
    beforeEach(module('grafana.services'));

    beforeEach(ctx.providePhase({
      'dashboardKeybindings': sinon.stub(),
      'templateValuesSrv': sinon.stub(),
      'unsavedChangesSrv': sinon.stub(),
      'contextSrv': sinon.stub(),
    }));

    beforeEach(ctx.createControllerPhase('DashboardCtrl'));

    describe('initialising dynamic datasources', function () {
      beforeEach(function () {
        var dashboardData = {templating:{list:[
          {name: 'test1', current: {value:'expected1'}, type:'datasource'},
          {name: 'test2', current: {value:'expected2'}, type:'query'}
        ]}};

        ctx.datasourceSrv.resetDynamicDatasources = sinon.spy();
        ctx.datasourceSrv.addDynamicDatasource = sinon.spy();
        ctx.scope.initDynamicDatasources(dashboardData);
      });

      it('should reset all dynamic datasources', function () {
        expect(ctx.datasourceSrv.resetDynamicDatasources.callCount).to.be(1);
      });

      it('should register dynamic datasources', function () {
        expect(ctx.datasourceSrv.addDynamicDatasource.withArgs('test1', 'expected1').callCount).to.be(1);
      });

      it('should not register non-dynamic datasources', function () {
        expect(ctx.datasourceSrv.addDynamicDatasource.callCount).to.be(1);
      });
    });
  });
});
