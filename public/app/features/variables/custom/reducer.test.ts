import { reducerTester } from '../../../../test/core/redux/reducerTester';
import cloneDeep from 'lodash/cloneDeep';
import { getVariableTestContext } from '../state/helpers';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, toVariablePayload } from '../state/types';
import { createCustomOptionsFromQuery, customVariableReducer } from './reducer';
import { createCustomVariableAdapter } from './adapter';
import { VariablesState } from '../state/variablesReducer';
import { CustomVariableModel } from '../../templating/types';

describe('customVariableReducer', () => {
  const adapter = createCustomVariableAdapter();

  describe('when createCustomOptionsFromQuery is dispatched', () => {
    it('then state should be correct', () => {
      const query = 'a,b,c';
      const id = '0';
      const { initialState } = getVariableTestContext(adapter, { id, query });
      const payload = toVariablePayload({ id: '0', type: 'custom' });

      reducerTester<VariablesState>()
        .givenReducer(customVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
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
      const id = '0';
      const { initialState } = getVariableTestContext(adapter, { id, query });
      const payload = toVariablePayload({ id: '0', type: 'constant' });

      reducerTester<VariablesState>()
        .givenReducer(customVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
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
      const id = '0';
      const { initialState } = getVariableTestContext(adapter, { id, query, includeAll: true });
      const payload = toVariablePayload({ id: '0', type: 'constant' });

      reducerTester<VariablesState>()
        .givenReducer(customVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
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
