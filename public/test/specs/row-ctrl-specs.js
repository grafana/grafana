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

  });

});

