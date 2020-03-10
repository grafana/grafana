import { reducerTester } from '../../../../test/core/redux/reducerTester';
import cloneDeep from 'lodash/cloneDeep';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload, ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../state/types';
import { customVariableReducer, createCustomOptionsFromQuery } from './reducer';
import { createCustomVariableAdapter } from '../custom/adapter';
import { VariablesState } from '../state/variablesReducer';
import { CustomVariableModel } from '../variable';

describe('customVariableReducer', () => {
  const adapter = createCustomVariableAdapter();

  describe('when createCustomOptionsFromQuery is dispatched', () => {
    it('then state should be correct', () => {
      const query = 'a,b,c';
      const uuid = '0';
      const { initialState } = getVariableTestContext(adapter, { uuid, query });
      const payload = toVariablePayload({ uuid: '0', type: 'custom' });

      reducerTester<VariablesState>()
        .givenReducer(customVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
            options: [
              {
                text: 'a',
                value: 'a',
                selected: false,
              },
              {
                text: 'b',
                value: 'b',
                selected: false,
              },
              {
                text: 'c',
                value: 'c',
                selected: false,
              },
            ],
          } as CustomVariableModel,
        });
    });
  });

  describe('when createCustomOptionsFromQuery is dispatched and query contains spaces', () => {
    it('then state should be correct', () => {
      const query = 'a,  b,   c';
      const uuid = '0';
      const { initialState } = getVariableTestContext(adapter, { uuid, query });
      const payload = toVariablePayload({ uuid: '0', type: 'constant' });

      reducerTester<VariablesState>()
        .givenReducer(customVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
            options: [
              {
                text: 'a',
                value: 'a',
                selected: false,
              },
              {
                text: 'b',
                value: 'b',
                selected: false,
              },
              {
                text: 'c',
                value: 'c',
                selected: false,
              },
            ],
          } as CustomVariableModel,
        });
    });
  });

  describe('when createCustomOptionsFromQuery is dispatched and includeAll is true', () => {
    it('then state should be correct', () => {
      const query = 'a,b,c';
      const uuid = '0';
      const { initialState } = getVariableTestContext(adapter, { uuid, query, includeAll: true });
      const payload = toVariablePayload({ uuid: '0', type: 'constant' });

      reducerTester<VariablesState>()
        .givenReducer(customVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
            options: [
              {
                text: ALL_VARIABLE_TEXT,
                value: ALL_VARIABLE_VALUE,
                selected: false,
              },
              {
                text: 'a',
                value: 'a',
                selected: false,
              },
              {
                text: 'b',
                value: 'b',
                selected: false,
              },
              {
                text: 'c',
                value: 'c',
                selected: false,
              },
            ],
          } as CustomVariableModel,
        });
    });
  });
});
