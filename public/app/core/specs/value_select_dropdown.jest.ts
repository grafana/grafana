//import { describe, beforeEach, it, expect, angularMocks, sinon } from 'test/lib/common';
import 'app/core/directives/value_select_dropdown';
import { ValueSelectDropdownCtrl } from '../directives/value_select_dropdown';
import q from 'q';

describe('SelectDropdownCtrl', () => {
  //let scope;

  let tagValuesMap: any = {};
  //let rootScope;
  //   let q = {
  //       when: jest.fn(() => Promise.resolve({}))
  //   };

  ValueSelectDropdownCtrl.prototype.onUpdated = jest.fn();
  let ctrl;

  //beforeEach(angularMocks.module('grafana.core'));
  //   beforeEach(
  //     angularMocks.inject(($ =>controller, $rootScope, $q, $httpBackend) {
  //       rootScope = $rootScope;
  //       q = $q;
  //       scope = $rootScope.$new();
  //       ctrl = $controller('ValueSelectDropdownCtrl', { $scope: scope });
  //       ctrl.onUpdated = sinon.spy();
  //       $httpBackend.when('GET', /\.html$/).respond('');
  //     })
  //   );

  describe('Given simple variable', () => {
    beforeEach(() => {
      ctrl = new ValueSelectDropdownCtrl(q);
      ctrl.variable = {
        current: { text: 'hej', value: 'hej' },
        getValuesForTag: key => {
          return Promise.resolve(tagValuesMap[key]);
        },
      };
      ctrl.init();
    });

    it('Should init labelText and linkText', () => {
      expect(ctrl.linkText).toBe('hej');
    });
  });

  describe('Given variable with tags and dropdown is opened', () => {
    beforeEach(() => {
      ctrl = new ValueSelectDropdownCtrl(q);
      ctrl.variable = {
        current: { text: 'server-1', value: 'server-1' },
        options: [
          { text: 'server-1', value: 'server-1', selected: true },
          { text: 'server-2', value: 'server-2' },
          { text: 'server-3', value: 'server-3' },
        ],
        tags: ['key1', 'key2', 'key3'],
        getValuesForTag: key => {
          return Promise.resolve(tagValuesMap[key]);
        },
        multi: true,
      };
      tagValuesMap.key1 = ['server-1', 'server-3'];
      tagValuesMap.key2 = ['server-2', 'server-3'];
      tagValuesMap.key3 = ['server-1', 'server-2', 'server-3'];
      ctrl.init();
      ctrl.show();
    });

    it('should init tags model', () => {
      expect(ctrl.tags.length).toBe(3);
      expect(ctrl.tags[0].text).toBe('key1');
    });

    it('should init options model', () => {
      expect(ctrl.options.length).toBe(3);
    });

    it('should init selected values array', () => {
      expect(ctrl.selectedValues.length).toBe(1);
    });

    it('should set linkText', () => {
      expect(ctrl.linkText).toBe('server-1');
    });

    describe('after adititional value is selected', () => {
      beforeEach(() => {
        ctrl.selectValue(ctrl.options[2], {});
        ctrl.commitChanges();
      });

      it('should update link text', () => {
        expect(ctrl.linkText).toBe('server-1 + server-3');
      });
    });

    describe('When tag is selected', () => {
      beforeEach(async () => {
        await ctrl.selectTag(ctrl.tags[0]);
        //rootScope.$digest();
        ctrl.commitChanges();
      });

      it('should select tag', () => {
        expect(ctrl.selectedTags.length).toBe(1);
      });

      it('should select values', () => {
        expect(ctrl.options[0].selected).toBe(true);
        expect(ctrl.options[2].selected).toBe(true);
      });

      it('link text should not include tag values', () => {
        expect(ctrl.linkText).toBe('');
      });

      describe('and then dropdown is opened and closed without changes', () => {
        beforeEach(() => {
          ctrl.show();
          ctrl.commitChanges();
          //rootScope.$digest();
        });

        it('should still have selected tag', () => {
          expect(ctrl.selectedTags.length).toBe(1);
        });
      });

      describe('and then unselected', () => {
        beforeEach(async () => {
          // console.log(ctrl.options);
          // console.log(ctrl.selectedTags);
          ctrl.selectTag(ctrl.tags[0]);
          //     console.log(ctrl.options);
          //   console.log(ctrl.selectedTags);
          //   console.log(ctrl.tags[0]);
          //rootScope.$digest();
        });

        it('should deselect tag', () => {
          expect(ctrl.selectedTags.length).toBe(0);
        });
      });

      describe('and then value is unselected', () => {
        beforeEach(() => {
          ctrl.selectValue(ctrl.options[0], {});
        });

        it('should deselect tag', () => {
          expect(ctrl.selectedTags.length).toBe(0);
        });
      });
    });
  });

  describe('Given variable with selected tags', () => {
    beforeEach(() => {
      ctrl = new ValueSelectDropdownCtrl(q);
      ctrl.variable = {
        current: {
          text: 'server-1',
          value: 'server-1',
          tags: [{ text: 'key1', selected: true }],
        },
        options: [
          { text: 'server-1', value: 'server-1' },
          { text: 'server-2', value: 'server-2' },
          { text: 'server-3', value: 'server-3' },
        ],
        tags: ['key1', 'key2', 'key3'],
        getValuesForTag: key => {
          return Promise.resolve(tagValuesMap[key]);
        },
        multi: true,
      };
      ctrl.init();
      ctrl.show();
    });

    it('should set tag as selected', () => {
      expect(ctrl.tags[0].selected).toBe(true);
    });
  });
});
