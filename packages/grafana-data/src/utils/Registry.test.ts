import { FieldReducerInfo, fieldReducers, ReducerID } from '../transformations';

import { Registry } from './Registry';

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
  });
});
