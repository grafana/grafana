import { reducerTester } from '../../../../test/core/redux/reducerTester';
import cloneDeep from 'lodash/cloneDeep';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { constantVariableReducer, createConstantOptionsFromQuery } from './reducer';
import { createCustomVariableAdapter } from '../custom/adapter';
import { VariablesState } from '../state/variablesReducer';
import { VariableOption, CustomVariableModel } from '../variable';

describe('constantVariableReducer', () => {
  const adapter = createCustomVariableAdapter();

  describe('when createConstantOptionsFromQuery is dispatched', () => {
    it('then state should be correct', () => {
      const query = 'ABC';
      const uuid = '0';
      const { initialState } = getVariableTestContext(adapter, { uuid, query });
      const payload = toVariablePayload({ uuid: '0', type: 'constant' });

      reducerTester<VariablesState>()
        .givenReducer(constantVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createConstantOptionsFromQuery(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
            options: [
              {
                text: query,
                value: query,
                selected: false,
              } as VariableOption,
            ],
          } as CustomVariableModel,
        });
    });
  });

  describe('when createConstantOptionsFromQuery is dispatched and query contains spaces', () => {
    it('then state should be correct', () => {
      const query = '  ABC  ';
      const uuid = '0';
      const { initialState } = getVariableTestContext(adapter, { uuid, query });
      const payload = toVariablePayload({ uuid: '0', type: 'constant' });

      reducerTester<VariablesState>()
        .givenReducer(constantVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createConstantOptionsFromQuery(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
            options: [
              {
                text: query.trim(),
                value: query.trim(),
                selected: false,
              } as VariableOption,
            ],
          } as CustomVariableModel,
        });
    });
  });
});
