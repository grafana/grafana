define([
  './helpers',
  'app/features/dashboard/rowCtrl'
], function(helpers) {
  'use strict';

  describe('RowCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.controllers'));

    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('RowCtrl'));

    describe('delete_row', function () {
      describe('when row is empty (has no panels)', function () {
        beforeEach(function () {
          ctx.scope.dashboard.rows = [{id: 1, panels: []}];
          ctx.scope.row = ctx.scope.dashboard.rows[0];
          ctx.scope.appEvent = sinon.spy();

          ctx.scope.delete_row();
        });

        it('should NOT ask for confirmation', function () {
          expect(ctx.scope.appEvent.called).to.be(false);
        });

        it('should delete row', function () {
          expect(ctx.scope.dashboard.rows).to.not.contain(ctx.scope.row);
        });
      });
    });
  });
});
