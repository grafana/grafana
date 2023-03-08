import { reducerTester } from 'test/core/redux/reducerTester';

import { Filter } from '../../../../../../types';

import { addFilter, changeFilter, removeFilter } from './actions';
import { reducer } from './reducer';

describe('Filters Bucket Aggregation Settings Reducer', () => {
  it('Should correctly add new filter', () => {
    reducerTester<Filter[]>()
      .givenReducer(reducer, [])
      .whenActionIsDispatched(addFilter())
      .thenStatePredicateShouldEqual((state: Filter[]) => state.length === 1);
  });

  it('Should correctly remove filters', () => {
    const firstFilter: Filter = {
      label: 'First',
      query: '*',
    };

    const secondFilter: Filter = {
      label: 'Second',
      query: '*',
    };

    reducerTester<Filter[]>()
      .givenReducer(reducer, [firstFilter, secondFilter])
      .whenActionIsDispatched(removeFilter(0))
      .thenStateShouldEqual([secondFilter]);
  });

  it("Should correctly change filter's attributes", () => {
    const firstFilter: Filter = {
      label: 'First',
      query: '*',
    };

    const secondFilter: Filter = {
      label: 'Second',
      query: '*',
    };

    const expectedSecondFilter: Filter = {
      label: 'Changed label',
      query: 'Changed query',
    };

    reducerTester<Filter[]>()
      .givenReducer(reducer, [firstFilter, secondFilter])
      .whenActionIsDispatched(changeFilter({ index: 1, filter: expectedSecondFilter }))
      .thenStateShouldEqual([firstFilter, expectedSecondFilter]);
  });
});
