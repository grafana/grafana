import { fieldReducers, type FieldReducerInfo, ReducerID } from '../transformations/fieldReducer';

import { Registry, type RegistryItem } from './Registry';

const makeRegistry = (items: RegistryItem[]) => new Registry(() => items);

describe('Registry', () => {
  describe('selectOptions', () => {
    describe('when called with current', () => {
      it('then order in select.current should be same as current', () => {
        const list = fieldReducers.list();
        const registry = new Registry<FieldReducerInfo>(() => list);
        const current = [ReducerID.step, ReducerID.mean, ReducerID.allIsZero, ReducerID.first, ReducerID.delta];
        const select = registry.selectOptions(current);
        expect(select.current).toEqual([
          { description: 'Minimum interval between values', label: 'Step', value: 'step' },
          { description: 'Average Value', label: 'Mean', value: 'mean' },
          { description: 'All values are zero', label: 'All Zeros', value: 'allIsZero' },
          { description: 'First Value', label: 'First', value: 'first' },
          { description: 'Cumulative change in value', label: 'Delta', value: 'delta' },
        ]);
      });

      describe('when called without current', () => {
        it('then it should return an empty array', () => {
          const list = fieldReducers.list();
          const registry = new Registry<FieldReducerInfo>(() => list);
          const select = registry.selectOptions();
          expect(select.current).toEqual([]);
        });
      });
    });

    describe('formatLabel', () => {
      it('uses item.name as label by default', () => {
        const registry = makeRegistry([{ id: 'foo', name: 'Foo' }]);
        const { options } = registry.selectOptions();
        expect(options[0].label).toBe('Foo');
      });

      it('uses the provided formatLabel function to build the label', () => {
        type CustomItem = RegistryItem & { displayName: string };
        const registry = new Registry<CustomItem>(() => [
          { id: 'a', name: 'Internal A', displayName: 'Pretty A' },
          { id: 'b', name: 'Internal B', displayName: 'Pretty B' },
        ]);
        const { options } = registry.selectOptions(undefined, undefined, (item) => item.displayName);
        expect(options[0].label).toBe('Pretty A');
        expect(options[1].label).toBe('Pretty B');
      });

      it('excludes items with excludeFromPicker set to true', () => {
        const registry = makeRegistry([
          { id: 'visible', name: 'Visible' },
          { id: 'hidden', name: 'Hidden', excludeFromPicker: true },
        ]);
        const { options } = registry.selectOptions();
        expect(options).toHaveLength(1);
        expect(options[0].value).toBe('visible');
      });
    });
  });
});
