define([
  './helpers',
  'app/plugins/datasource/elasticsearch/queryCtrl',
  'app/services/uiSegmentSrv'
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

      it('should init selectSegments', function() {
        expect(ctx.scope.selectSegments.length).to.be(2);
      });

      describe('initSelectSegments with 2 selects', function() {

        it('init selectSegments', function() {
          ctx.scope.target.select = [
            {agg: 'count'},
            {agg: 'avg', field: 'value'},
          ];
          ctx.scope.initSelectSegments();

          expect(ctx.scope.selectSegments.length).to.be(5);
          expect(ctx.scope.selectSegments[0].value).to.be('count');
          expect(ctx.scope.selectSegments[1].value).to.be(' and ');
          expect(ctx.scope.selectSegments[2].value).to.be('avg');
          expect(ctx.scope.selectSegments[3].value).to.be('value');
        });
      });

    });

  });
});
