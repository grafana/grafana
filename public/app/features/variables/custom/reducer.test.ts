import { cloneDeep } from 'lodash';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../constants';
import { getVariableTestContext } from '../state/helpers';
import { VariablesState } from '../state/types';
import { CustomVariableModel } from '../types';
import { toVariablePayload } from '../utils';

import { createCustomVariableAdapter } from './adapter';
import { createCustomOptionsFromQuery, customVariableReducer } from './reducer';

describe('customVariableReducer', () => {
  const adapter = createCustomVariableAdapter();

  describe('when createCustomOptionsFromQuery is dispatched with key/value syntax', () => {
    it('should then mutate state correctly', () => {
      const query = 'a,b,c,d : e';
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
              {
                text: 'd',
                value: 'e',
                selected: false,
              },
            ],
          } as CustomVariableModel,
        });
    });
  });

  describe('when createCustomOptionsFromQuery is dispatched without key/value syntax', () => {
    it('should then mutate state correctly', () => {
      const query = 'a,b,c,d:e';
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
              {
                text: 'd:e',
                value: 'd:e',
                selected: false,
              },
            ],
          } as CustomVariableModel,
        });
    });
  });

  describe('when createCustomOptionsFromQuery is dispatched and query with key/value syntax contains spaces', () => {
    it('should then mutate state correctly', () => {
      const query = 'a,  b,   c, d : e  ';
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
              {
                text: 'd',
                value: 'e',
                selected: false,
              },
            ],
          } as CustomVariableModel,
        });
    });
  });

  describe('when createCustomOptionsFromQuery is dispatched and query without key/value syntax contains spaces', () => {
    it('should then mutate state correctly', () => {
      const query = 'a,  b,   c, d :    e';
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
              {
                text: 'd',
                value: 'e',
                selected: false,
              },
            ],
          } as CustomVariableModel,
        });
    });
  });

  describe('when createCustomOptionsFromQuery is dispatched and query without key/value syntax contains urls', () => {
    it('should then mutate state correctly', () => {
      const query = 'a,  b,http://www.google.com/, http://www.amazon.com/';
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
                text: 'http://www.google.com/',
                value: 'http://www.google.com/',
                selected: false,
              },
              {
                text: 'http://www.amazon.com/',
                value: 'http://www.amazon.com/',
                selected: false,
              },
            ],
          } as CustomVariableModel,
        });
    });
  });

  describe('when createCustomOptionsFromQuery is dispatched and query with key/value syntax contains urls', () => {
    it('should then mutate state correctly', () => {
      const query = 'a,  b, google : http://www.google.com/, amazon : http://www.amazon.com/';
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
                text: 'google',
                value: 'http://www.google.com/',
                selected: false,
              },
              {
                text: 'amazon',
                value: 'http://www.amazon.com/',
                selected: false,
              },
            ],
          } as CustomVariableModel,
        });
    });
  });

  describe('when createCustomOptionsFromQuery is dispatched and includeAll is true', () => {
    it('should then mutate state correctly', () => {
      const query = 'a,b,c,d : e';
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
              {
                text: 'd',
                value: 'e',
                selected: false,
              },
            ],
          } as CustomVariableModel,
        });
    });
  });
});
