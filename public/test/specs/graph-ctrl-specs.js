define([
  './helpers',
  'app/features/panel/panel_srv',
  'app/features/panel/panel_helper',
  'app/panels/graph/module'
], function(helpers) {
  'use strict';

  describe('GraphCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(module('grafana.panels.graph'));

    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('GraphCtrl'));

    describe('get_data with 2 series', function() {
      beforeEach(function() {
        ctx.annotationsSrv.getAnnotations = sinon.stub().returns(ctx.$q.when([]));
        ctx.idMapSrv.getIdMap = sinon.stub().returns(ctx.$q.when([]));
        ctx.datasource.query = sinon.stub().returns(ctx.$q.when({
          data: [
            { target: 'test.cpu1', datapoints: [[1, 10]]},
            { target: 'test.cpu2', datapoints: [[1, 10]]}
          ]
        }));
        ctx.scope.render = sinon.spy();
        ctx.scope.refreshData(ctx.datasource);
        ctx.scope.$digest();
      });

      it('should send time series to render', function() {
        var data = ctx.scope.render.getCall(0).args[0];
        expect(data.length).to.be(2);
      });

      describe('get_data failure following success', function() {
        beforeEach(function() {
          ctx.datasource.query = sinon.stub().returns(ctx.$q.reject('Datasource Error'));
          ctx.scope.refreshData(ctx.datasource);
          ctx.scope.$digest();
        });

      });

    });

  });

});

