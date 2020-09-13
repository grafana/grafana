import { reducerTester } from '../../../../test/core/redux/reducerTester';
import cloneDeep from 'lodash/cloneDeep';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { adHocVariableReducer, filterAdded, filterRemoved, filtersRestored, filterUpdated } from './reducer';
import { VariablesState } from '../state/variablesReducer';
import { AdHocVariableFilter, AdHocVariableModel } from '../types';
import { createAdHocVariableAdapter } from './adapter';

describe('adHocVariableReducer', () => {
  const adapter = createAdHocVariableAdapter();

  describe('when filterAdded is dispatched', () => {
    it('then state should be correct', () => {
      const id = '0';
      const { initialState } = getVariableTestContext(adapter, { id });
      const filter = createFilter('a');
      const payload = toVariablePayload({ id, type: 'adhoc' }, filter);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterAdded(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            filters: [{ value: 'a', operator: '=', condition: '', key: 'a' }],
          } as AdHocVariableModel,
        });
    });
  });

  describe('when filterAdded is dispatched and filter already exists', () => {
    it('then state should be correct', () => {
      const id = '0';
      const filterA = createFilter('a');
      const filterB = createFilter('b');
      const { initialState } = getVariableTestContext(adapter, { id, filters: [filterA] });
      const payload = toVariablePayload({ id, type: 'adhoc' }, filterB);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterAdded(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            filters: [
              { value: 'a', operator: '=', condition: '', key: 'a' },
              { value: 'b', operator: '=', condition: '', key: 'b' },
            ],
          } as AdHocVariableModel,
        });
    });
  });

  describe('when filterRemoved is dispatched to remove second filter', () => {
    it('then state should be correct', () => {
      const id = '0';
      const filterA = createFilter('a');
      const filterB = createFilter('b');
      const index = 1;
      const { initialState } = getVariableTestContext(adapter, { id, filters: [filterA, filterB] });
      const payload = toVariablePayload({ id, type: 'adhoc' }, index);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterRemoved(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            filters: [{ value: 'a', operator: '=', condition: '', key: 'a' }],
          } as AdHocVariableModel,
        });
    });
  });

  describe('when filterRemoved is dispatched to remove first filter', () => {
    it('then state should be correct', () => {
      const id = '0';
      const filterA = createFilter('a');
      const filterB = createFilter('b');
      const index = 0;
      const { initialState } = getVariableTestContext(adapter, { id, filters: [filterA, filterB] });
      const payload = toVariablePayload({ id, type: 'adhoc' }, index);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterRemoved(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            filters: [{ value: 'b', operator: '=', condition: '', key: 'b' }],
          } as AdHocVariableModel,
        });
    });
  });

  describe('when filterRemoved is dispatched to all filters', () => {
    it('then state should be correct', () => {
      const id = '0';
      const filterA = createFilter('a');
      const index = 0;
      const { initialState } = getVariableTestContext(adapter, { id, filters: [filterA] });
      const payload = toVariablePayload({ id, type: 'adhoc' }, index);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterRemoved(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            filters: [] as AdHocVariableFilter[],
          } as AdHocVariableModel,
        });
    });
  });

  describe('when filterUpdated is dispatched', () => {
    it('then state should be correct', () => {
      const id = '0';
      const original = createFilter('a');
      const other = createFilter('b');
      const filter = createFilter('aa');
      const index = 1;
      const { initialState } = getVariableTestContext(adapter, { id, filters: [other, original] });
      const payload = toVariablePayload({ id, type: 'adhoc' }, { index, filter });

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterUpdated(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            filters: [
              { value: 'b', operator: '=', condition: '', key: 'b' },
              { value: 'aa', operator: '=', condition: '', key: 'aa' },
            ],
          } as AdHocVariableModel,
        });
    });
  });

  describe('when filterUpdated is dispatched to update operator', () => {
    it('then state should be correct', () => {
      const id = '0';
      const original = createFilter('a');
      const other = createFilter('b');
      const filter = createFilter('aa', '>');
      const index = 1;
      const { initialState } = getVariableTestContext(adapter, { id, filters: [other, original] });
      const payload = toVariablePayload({ id, type: 'adhoc' }, { index, filter });

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterUpdated(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            filters: [
              { value: 'b', operator: '=', condition: '', key: 'b' },
              { value: 'aa', operator: '>', condition: '', key: 'aa' },
            ],
          } as AdHocVariableModel,
        });
    });
  });

  describe('when filtersRestored is dispatched', () => {
    it('then state should be correct', () => {
      const id = '0';
      const original = [createFilter('a'), createFilter('b')];
      const restored = [createFilter('aa'), createFilter('bb')];
      const { initialState } = getVariableTestContext(adapter, { id, filters: original });
      const payload = toVariablePayload({ id, type: 'adhoc' }, restored);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filtersRestored(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            filters: [
              { value: 'aa', operator: '=', condition: '', key: 'aa' },
              { value: 'bb', operator: '=', condition: '', key: 'bb' },
            ],
          } as AdHocVariableModel,
        });
    });
  });

  describe('when filtersRestored is dispatched on variabel with no filters', () => {
    it('then state should be correct', () => {
      const id = '0';
      const restored = [createFilter('aa'), createFilter('bb')];
      const { initialState } = getVariableTestContext(adapter, { id });
      const payload = toVariablePayload({ id, type: 'adhoc' }, restored);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filtersRestored(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            filters: [
              { value: 'aa', operator: '=', condition: '', key: 'aa' },
              { value: 'bb', operator: '=', condition: '', key: 'bb' },
            ],
          } as AdHocVariableModel,
        });
    });
  });
});

function createFilter(value: string, operator = '='): AdHocVariableFilter {
  return {
    value,
    operator,
    condition: '',
    key: value,
  };
}
