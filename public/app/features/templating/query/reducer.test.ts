import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { queryVariableReducer } from './reducer';
import { toVariablePayload, updateVariableOptions, updateVariableTags } from '../state/actions';
import { QueryVariableModel, VariableOption } from '../variable';
import cloneDeep from 'lodash/cloneDeep';
import { VariablesState } from '../state/variablesReducer';
import { getVariableTestContext } from '../state/helpers';

describe('queryVariableReducer', () => {
  describe('when updateVariableOptions is dispatched and includeAll is true', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: true });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [
              { text: 'All', value: '$__all', selected: false },
              { text: 'A', value: 'A', selected: false },
              { text: 'B', value: 'B', selected: false },
            ],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: false });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [
              { text: 'A', value: 'A', selected: false },
              { text: 'B', value: 'B', selected: false },
            ],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is true and payload is an empty array', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: true });
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, []);
      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [{ text: 'All', value: '$__all', selected: false }],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false and payload is an empty array', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: false });
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, []);
      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [{ text: 'None', value: '', selected: false, isNone: true }],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is true and regex is set', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: true, regex: '/.*(a).*/i' });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [
              { text: 'All', value: '$__all', selected: false },
              { text: 'A', value: 'A', selected: false },
            ],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableOptions is dispatched and includeAll is false and regex is set', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext({ includeAll: false, regex: '/.*(a).*/i' });
      const options: VariableOption[] = [
        { text: 'A', value: 'A', selected: false },
        { text: 'B', value: 'B', selected: false },
      ];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, options);
      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableOptions(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            options: [{ text: 'A', value: 'A', selected: false }],
          } as unknown) as QueryVariableModel,
        });
    });
  });

  describe('when updateVariableTags is dispatched', () => {
    it('then state should be correct', () => {
      const { initialState } = getVariableTestContext();
      const tags: any[] = [{ text: 'A' }, { text: 'B' }];
      const payload = toVariablePayload({ uuid: '0', type: 'query' }, tags);
      reducerTester<VariablesState>()
        .givenReducer(queryVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(updateVariableTags(payload))
        .thenStateShouldEqual({
          ...initialState,
          '0': ({
            ...initialState[0],
            tags: [
              { text: 'A', selected: false },
              { text: 'B', selected: false },
            ],
          } as unknown) as QueryVariableModel,
        });
    });
  });
});
