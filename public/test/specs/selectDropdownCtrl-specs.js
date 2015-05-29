define([
  'directives/variableValueSelect',
],
function () {
  'use strict';


  describe("SelectDropdownCtrl", function() {
    var scope;
    var ctrl;

    beforeEach(module('grafana.controllers'));
    beforeEach(inject(function($controller, $rootScope) {
      scope = $rootScope.$new();
      ctrl = $controller('SelectDropdownCtrl', {$scope: scope});
    }));

    describe("Given simple variable", function() {
      beforeEach(function() {
        ctrl.variable = {current: {text: 'hej', value: 'hej' }};
        ctrl.init();
      });

      it("Should init labelText and linkText", function() {
        expect(ctrl.linkText).to.be("hej");
      });

    });

  });

});
