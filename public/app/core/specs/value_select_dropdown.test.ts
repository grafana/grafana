import 'app/core/directives/value_select_dropdown';
import { ValueSelectDropdownCtrl } from '../directives/value_select_dropdown';
// @ts-ignore
import q from 'q';
import { IScope } from 'angular';

describe('SelectDropdownCtrl', () => {
  const tagValuesMap: any = {};
  const $scope: IScope = {} as IScope;

  ValueSelectDropdownCtrl.prototype.onUpdated = jest.fn();
  let ctrl: ValueSelectDropdownCtrl;

  describe('Given simple variable', () => {
    beforeEach(() => {
      ctrl = new ValueSelectDropdownCtrl(q, $scope);
      ctrl.variable = {
        current: { text: 'hej', value: 'hej' },
        getValuesForTag: (key: string) => {
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
      ctrl = new ValueSelectDropdownCtrl(q, $scope);
      ctrl.variable = {
        current: { text: 'server-1', value: 'server-1' },
        options: [
          { text: 'server-1', value: 'server-1', selected: true },
          { text: 'server-2', value: 'server-2' },
          { text: 'server-3', value: 'server-3' },
        ],
        tags: ['key1', 'key2', 'key3'],
        getValuesForTag: (key: string) => {
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
        });

        it('should still have selected tag', () => {
          expect(ctrl.selectedTags.length).toBe(1);
        });
      });

      describe('and then unselected', () => {
        beforeEach(async () => {
          await ctrl.selectTag(ctrl.tags[0]);
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
      ctrl = new ValueSelectDropdownCtrl(q, $scope);
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
        getValuesForTag: (key: any) => {
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

describe('queryChanged', () => {
  describe('when called and variable query contains search filter', () => {
    it('then it should use lazy loading', async () => {
      const $scope = {} as IScope;
      const ctrl = new ValueSelectDropdownCtrl(q, $scope);
      const options = [
        { text: 'server-1', value: 'server-1' },
        { text: 'server-2', value: 'server-2' },
        { text: 'server-3', value: 'server-3' },
      ];
      ctrl.lazyLoadOptions = jest.fn().mockResolvedValue(options);
      ctrl.updateUIBoundOptions = jest.fn();
      ctrl.search = {
        query: 'alpha',
      };
      ctrl.queryHasSearchFilter = true;

      await ctrl.queryChanged();

      expect(ctrl.lazyLoadOptions).toBeCalledTimes(1);
      expect(ctrl.lazyLoadOptions).toBeCalledWith('alpha');
      expect(ctrl.updateUIBoundOptions).toBeCalledTimes(1);
      expect(ctrl.updateUIBoundOptions).toBeCalledWith($scope, options);
    });
  });

  describe('when called and variable query does not contain search filter', () => {
    it('then it should not use lazy loading', async () => {
      const $scope = {} as IScope;
      const ctrl = new ValueSelectDropdownCtrl(q, $scope);
      ctrl.lazyLoadOptions = jest.fn().mockResolvedValue([]);
      ctrl.updateUIBoundOptions = jest.fn();
      ctrl.search = {
        query: 'alpha',
      };
      ctrl.queryHasSearchFilter = false;

      await ctrl.queryChanged();

      expect(ctrl.lazyLoadOptions).toBeCalledTimes(0);
      expect(ctrl.updateUIBoundOptions).toBeCalledTimes(1);
    });
  });
});

describe('lazyLoadOptions', () => {
  describe('when called with a query', () => {
    it('then the variables updateOptions should be called with the query', async () => {
      const $scope = {} as IScope;
      const ctrl = new ValueSelectDropdownCtrl(q, $scope);
      ctrl.variable = {
        updateOptions: jest.fn(),
        options: [
          { text: 'server-1', value: 'server-1' },
          { text: 'server-2', value: 'server-2' },
          { text: 'server-3', value: 'server-3' },
        ],
      };
      const query = 'server-1';

      const result = await ctrl.lazyLoadOptions(query);

      expect(ctrl.variable.updateOptions).toBeCalledTimes(1);
      expect(ctrl.variable.updateOptions).toBeCalledWith(query);
      expect(result).toEqual(ctrl.variable.options);
    });
  });
});

describe('updateUIBoundOptions', () => {
  describe('when called with options', () => {
    let options: any[];
    let ctrl: ValueSelectDropdownCtrl;
    let $scope: IScope;

    beforeEach(() => {
      $scope = ({
        $apply: jest.fn(),
      } as any) as IScope;
      options = [];
      for (let index = 0; index < 1001; index++) {
        options.push({ text: `server-${index}`, value: `server-${index}` });
      }
      ctrl = new ValueSelectDropdownCtrl(q, $scope);
      ctrl.highlightIndex = 0;
      ctrl.options = [];
      ctrl.search = {
        options: [],
      };
      ctrl.updateUIBoundOptions($scope, options);
    });

    it('then highlightIndex should be reset to first item', () => {
      expect(ctrl.highlightIndex).toEqual(0);
    });

    it('then search.options should be same as options but capped to 1000', () => {
      expect(ctrl.search.options.length).toEqual(1000);

      for (let index = 0; index < 1000; index++) {
        expect(ctrl.search.options[index]).toEqual(options[index]);
      }
    });

    it('then scope apply should be called', () => {
      expect($scope.$apply).toBeCalledTimes(1);
    });
  });
});
