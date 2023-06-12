import { cloneDeep } from 'lodash';

import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { getVariableTestContext } from '../state/helpers';
import { VariablesState } from '../state/types';
import { ConstantVariableModel } from '../types';
import { toVariablePayload } from '../utils';

import { createConstantVariableAdapter } from './adapter';
import { constantVariableReducer, createConstantOptionsFromQuery } from './reducer';

describe('constantVariableReducer', () => {
  const adapter = createConstantVariableAdapter();

  describe('when createConstantOptionsFromQuery is dispatched', () => {
    it('then state should be correct', () => {
      const query = 'ABC';
      const id = '0';
      const { initialState } = getVariableTestContext(adapter, { id, query });
      const payload = toVariablePayload({ id: '0', type: 'constant' });

      reducerTester<VariablesState>()
        .givenReducer(constantVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createConstantOptionsFromQuery(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            options: [
              {
                text: query,
                value: query,
                selected: false,
              },
            ],
          } as ConstantVariableModel,
        });
    });
  });

  describe('when createConstantOptionsFromQuery is dispatched and query contains spaces', () => {
    it('then state should be correct', () => {
      const query = '  ABC  ';
      const id = '0';
      const { initialState } = getVariableTestContext(adapter, { id, query });
      const payload = toVariablePayload({ id: '0', type: 'constant' });

      reducerTester<VariablesState>()
        .givenReducer(constantVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createConstantOptionsFromQuery(payload))
        .thenStateShouldEqual({
          [id]: {
            ...initialState[id],
            options: [
              {
                text: query.trim(),
                value: query.trim(),
                selected: false,
              },
            ],
          } as ConstantVariableModel,
        });
    });
  });
});
