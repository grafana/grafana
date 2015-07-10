define([
  'helpers',
  'panels/graph/seriesOverridesCtrl'
], function(helpers) {
  'use strict';

  describe('SeriesOverridesCtrl', function() {
    var ctx = new helpers.ControllerTestContext();
    var popoverSrv = {};

    beforeEach(module('grafana.services'));
    beforeEach(module('grafana.panels.graph'));

    beforeEach(ctx.providePhase({
      popoverSrv: popoverSrv
    }));

    beforeEach(ctx.createControllerPhase('SeriesOverridesCtrl'));
    beforeEach(function() {
      ctx.scope.render = function() {};
    });

    describe('When setting an override', function() {
      beforeEach(function() {
        ctx.scope.setOverride({propertyName: 'lines'}, {value: true});
      });

      it('should set override property', function() {
        expect(ctx.scope.override.lines).to.be(true);
      });

      it('should update view model', function() {
        expect(ctx.scope.currentOverrides[0].name).to.be('Lines');
        expect(ctx.scope.currentOverrides[0].value).to.be('true');
      });
    });

    describe('When removing overide', function() {
      it('click should include option and value index', function() {
        ctx.scope.setOverride(1,0);
        ctx.scope.removeOverride({ propertyName: 'lines' });
        expect(ctx.scope.currentOverrides.length).to.be(0);
      });
    });

  });

});

