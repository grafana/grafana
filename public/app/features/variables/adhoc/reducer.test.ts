import { reducerTester } from '../../../../test/core/redux/reducerTester';
import cloneDeep from 'lodash/cloneDeep';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { adHocVariableReducer, filterAdded, filterRemoved, filterUpdated, filtersRestored } from './reducer';
import { VariablesState } from '../state/variablesReducer';
import { AdHocVariableModel, AdHocVariableFilter } from '../../templating/variable';
import { createAdHocVariableAdapter } from './adapter';

describe('adHocVariableReducer', () => {
  const adapter = createAdHocVariableAdapter();

  describe('when filterAdded is dispatched', () => {
    it('then state should be correct', () => {
      const uuid = '0';
      const { initialState } = getVariableTestContext(adapter, { uuid });
      const filter = createFilter('a');
      const payload = toVariablePayload({ uuid, type: 'adhoc' }, filter);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterAdded(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
            filters: [{ value: 'a', operator: '=', condition: '', key: 'a' }],
          } as AdHocVariableModel,
        });
    });
  });

  describe('when filterAdded is dispatched and filter already exists', () => {
    it('then state should be correct', () => {
      const uuid = '0';
      const filterA = createFilter('a');
      const filterB = createFilter('b');
      const { initialState } = getVariableTestContext(adapter, { uuid, filters: [filterA] });
      const payload = toVariablePayload({ uuid, type: 'adhoc' }, filterB);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterAdded(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
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
      const uuid = '0';
      const filterA = createFilter('a');
      const filterB = createFilter('b');
      const index = 1;
      const { initialState } = getVariableTestContext(adapter, { uuid, filters: [filterA, filterB] });
      const payload = toVariablePayload({ uuid, type: 'adhoc' }, index);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterRemoved(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
            filters: [{ value: 'a', operator: '=', condition: '', key: 'a' }],
          } as AdHocVariableModel,
        });
    });
  });

  describe('when filterRemoved is dispatched to remove first filter', () => {
    it('then state should be correct', () => {
      const uuid = '0';
      const filterA = createFilter('a');
      const filterB = createFilter('b');
      const index = 0;
      const { initialState } = getVariableTestContext(adapter, { uuid, filters: [filterA, filterB] });
      const payload = toVariablePayload({ uuid, type: 'adhoc' }, index);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterRemoved(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
            filters: [{ value: 'b', operator: '=', condition: '', key: 'b' }],
          } as AdHocVariableModel,
        });
    });
  });

  describe('when filterRemoved is dispatched to all filters', () => {
    it('then state should be correct', () => {
      const uuid = '0';
      const filterA = createFilter('a');
      const index = 0;
      const { initialState } = getVariableTestContext(adapter, { uuid, filters: [filterA] });
      const payload = toVariablePayload({ uuid, type: 'adhoc' }, index);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterRemoved(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
            filters: [] as AdHocVariableFilter[],
          } as AdHocVariableModel,
        });
    });
  });

  describe('when filterUpdated is dispatched', () => {
    it('then state should be correct', () => {
      const uuid = '0';
      const original = createFilter('a');
      const other = createFilter('b');
      const filter = createFilter('aa');
      const index = 1;
      const { initialState } = getVariableTestContext(adapter, { uuid, filters: [other, original] });
      const payload = toVariablePayload({ uuid, type: 'adhoc' }, { index, filter });

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterUpdated(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
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
      const uuid = '0';
      const original = createFilter('a');
      const other = createFilter('b');
      const filter = createFilter('aa', '>');
      const index = 1;
      const { initialState } = getVariableTestContext(adapter, { uuid, filters: [other, original] });
      const payload = toVariablePayload({ uuid, type: 'adhoc' }, { index, filter });

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filterUpdated(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
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
      const uuid = '0';
      const original = [createFilter('a'), createFilter('b')];
      const restored = [createFilter('aa'), createFilter('bb')];
      const { initialState } = getVariableTestContext(adapter, { uuid, filters: original });
      const payload = toVariablePayload({ uuid, type: 'adhoc' }, restored);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filtersRestored(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
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
      const uuid = '0';
      const restored = [createFilter('aa'), createFilter('bb')];
      const { initialState } = getVariableTestContext(adapter, { uuid });
      const payload = toVariablePayload({ uuid, type: 'adhoc' }, restored);

      reducerTester<VariablesState>()
        .givenReducer(adHocVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(filtersRestored(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
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
