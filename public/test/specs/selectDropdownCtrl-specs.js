define([
  'directives/variableValueSelect',
],
function () {
  'use strict';


  describe("SelectDropdownCtrl", function() {
    var scope;
    var ctrl;
    var tagValuesMap = {};
    var rootScope;

    beforeEach(module('grafana.controllers'));
    beforeEach(inject(function($controller, $rootScope, $q) {
      rootScope = $rootScope;
      scope = $rootScope.$new();
      ctrl = $controller('SelectDropdownCtrl', {$scope: scope});
      ctrl.getValuesForTag = function(obj) {
        return $q.when(tagValuesMap[obj.tagKey]);
      };
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

    describe("Given variable with tags and dropdown is opened", function() {
      beforeEach(function() {
        ctrl.variable = {
          current: {text: 'hej', value: 'hej'},
          options: [
            {text: 'server-1', value: 'server-1'},
            {text: 'server-2', value: 'server-2'},
            {text: 'server-3', value: 'server-3'},
          ],
          tags: ["key1", "key2", "key3"]
        };
        tagValuesMap.key1 = ['server-1', 'server-3'];
        tagValuesMap.key2 = ['server-2', 'server-3'];
        tagValuesMap.key3 = ['server-1', 'server-2', 'server-3'];
        ctrl.init();
        ctrl.show();
      });

      it("should init tags model", function() {
        expect(ctrl.tags.length).to.be(3);
        expect(ctrl.tags[0].text).to.be("key1");
      });

      it("should init options model", function() {
        expect(ctrl.options.length).to.be(3);
      });

      describe('When tag is selected', function() {
        beforeEach(function() {
          ctrl.selectTag(ctrl.tags[0]);
          rootScope.$digest();
        });

        it("should select tag", function() {
          expect(ctrl.selectedTags.length).to.be(1);
        });

        it("should select values", function() {
          expect(ctrl.options[0].selected).to.be(true);
          expect(ctrl.options[2].selected).to.be(true);
        });

        describe('and then unselected', function() {
          beforeEach(function() {
            ctrl.selectTag(ctrl.tags[0]);
            rootScope.$digest();
          });

          it("should deselect tag", function() {
            expect(ctrl.selectedTags.length).to.be(0);
          });
        });

        describe('and then value is unselected', function() {
          beforeEach(function() {
            ctrl.optionSelected(ctrl.options[0]);
          });

          it("should deselect tag", function() {
            expect(ctrl.selectedTags.length).to.be(0);
          });
        });
      });
    });
  });
});
