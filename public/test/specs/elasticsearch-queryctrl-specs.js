define([
  'helpers',
  'plugins/datasource/elasticsearch/queryCtrl',
  'services/uiSegmentSrv'
], function(helpers) {
  'use strict';

  describe('ElasticQueryCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.controllers'));
    beforeEach(module('grafana.services'));
    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('ElasticQueryCtrl'));

    beforeEach(function() {
      ctx.scope.target = {};
      ctx.scope.$parent = { get_data: sinon.spy() };

      ctx.scope.datasource = ctx.datasource;
      ctx.scope.datasource.metricFindQuery = sinon.stub().returns(ctx.$q.when([]));
    });

    describe('init', function() {
      beforeEach(function() {
        ctx.scope.init();
      });

    });

  });
});
