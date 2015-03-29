define([
    './helpers',
    'panels/overview/module'
], function(helpers) {
  'use strict';

  describe('OverviewCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    beforeEach(module('grafana.services'));
    beforeEach(module('grafana.panels.overview'));

    beforeEach(ctx.providePhase());
    beforeEach(ctx.createControllerPhase('OverviewCtrl'));

    describe('when query return error', function() {
      beforeEach(function() {
        ctx.datasource.query =  function() {
          return ctx.$q.reject({ message: 'Some error' });
        };
        ctx.scope.get_data();
        ctx.scope.$digest();
      });

      it('panel.error should be set', function() {
        expect(ctx.scope.panel.error).to.be("Some error");
      });
    });
  });
});
