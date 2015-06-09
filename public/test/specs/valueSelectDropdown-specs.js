define([
  'directives/valueSelectDropdown',
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
      ctrl = $controller('ValueSelectDropdownCtrl', {$scope: scope});
      ctrl.getValuesForTag = function(obj) {
        return $q.when(tagValuesMap[obj.tagKey]);
      };
      ctrl.onUpdated = sinon.spy();
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
          current: {text: 'server-1', value: 'server-1'},
          options: [
            {text: 'server-1', value: 'server-1'},
            {text: 'server-2', value: 'server-2'},
            {text: 'server-3', value: 'server-3'},
          ],
          tags: ["key1", "key2", "key3"],
          multi: true
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

      it("should init selected values array", function() {
        expect(ctrl.selectedValues.length).to.be(1);
      });

      it("should set linkText", function() {
        expect(ctrl.linkText).to.be('server-1');
      });

      describe('after adititional value is selected', function() {
        beforeEach(function() {
          ctrl.selectValue(ctrl.options[2], {});
          ctrl.commitChanges();
        });

        it('should update link text', function() {
          expect(ctrl.linkText).to.be('server-1 + server-3');
        });
      });

      describe('When tag is selected', function() {
        beforeEach(function() {
          ctrl.selectTag(ctrl.tags[0]);
          rootScope.$digest();
          ctrl.commitChanges();
        });

        it("should select tag", function() {
          expect(ctrl.selectedTags.length).to.be(1);
        });

        it("should select values", function() {
          expect(ctrl.options[0].selected).to.be(true);
          expect(ctrl.options[2].selected).to.be(true);
        });

        it("link text should not include tag values", function() {
          expect(ctrl.linkText).to.be('');
        });

        describe('and then dropdown is opened and closed without changes', function() {
          beforeEach(function() {
            ctrl.show();
            ctrl.commitChanges();
            rootScope.$digest();
          });

          it("should still have selected tag", function() {
            expect(ctrl.selectedTags.length).to.be(1);
          });
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
            ctrl.selectValue(ctrl.options[0], {});
          });

          it("should deselect tag", function() {
            expect(ctrl.selectedTags.length).to.be(0);
          });
        });
      });
    });

    describe("Given variable with selected tags", function() {
      beforeEach(function() {
        ctrl.variable = {
          current: {text: 'server-1', value: 'server-1', tags: [{text: 'key1', selected: true}] },
          options: [
            {text: 'server-1', value: 'server-1'},
            {text: 'server-2', value: 'server-2'},
            {text: 'server-3', value: 'server-3'},
          ],
          tags: ["key1", "key2", "key3"],
          multi: true
        };
        ctrl.init();
        ctrl.show();
      });

      it("should set tag as selected", function() {
        expect(ctrl.tags[0].selected).to.be(true);
      });

    });

  });
});
