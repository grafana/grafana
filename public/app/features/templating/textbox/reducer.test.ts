import { reducerTester } from '../../../../test/core/redux/reducerTester';
import cloneDeep from 'lodash/cloneDeep';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { textBoxVariableReducer, createTextBoxOptions } from './reducer';
import { VariablesState } from '../state/variablesReducer';
import { TextBoxVariableModel } from '../variable';
import { createTextBoxVariableAdapter } from './adapter';

describe('textBoxVariableReducer', () => {
  const adapter = createTextBoxVariableAdapter();

  describe('when createTextBoxOptions is dispatched', () => {
    it('then state should be correct', () => {
      const query = 'ABC';
      const uuid = '0';
      const { initialState } = getVariableTestContext(adapter, { uuid, query });
      const payload = toVariablePayload({ uuid: '0', type: 'textbox' });

      reducerTester<VariablesState>()
        .givenReducer(textBoxVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createTextBoxOptions(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
            options: [
              {
                text: query,
                value: query,
                selected: false,
              },
            ],
            current: {
              text: query,
              value: query,
              selected: false,
            },
          } as TextBoxVariableModel,
        });
    });
  });

  describe('when createTextBoxOptions is dispatched and query contains spaces', () => {
    it('then state should be correct', () => {
      const query = '  ABC  ';
      const uuid = '0';
      const { initialState } = getVariableTestContext(adapter, { uuid, query });
      const payload = toVariablePayload({ uuid: '0', type: 'textbox' });

      reducerTester<VariablesState>()
        .givenReducer(textBoxVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createTextBoxOptions(payload))
        .thenStateShouldEqual({
          [uuid]: {
            ...initialState[uuid],
            options: [
              {
                text: query.trim(),
                value: query.trim(),
                selected: false,
              },
            ],
            current: {
              text: query.trim(),
              value: query.trim(),
              selected: false,
            },
          } as TextBoxVariableModel,
        });
    });
  });
});
