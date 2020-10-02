import { reducerTester } from '../../../../test/core/redux/reducerTester';
import cloneDeep from 'lodash/cloneDeep';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { createTextBoxOptions, textBoxVariableReducer } from './reducer';
import { VariablesState } from '../state/variablesReducer';
import { TextBoxVariableModel } from '../types';
import { createTextBoxVariableAdapter } from './adapter';

describe('textBoxVariableReducer', () => {
  const adapter = createTextBoxVariableAdapter();

  describe('when createTextBoxOptions is dispatched', () => {
    it('then state should be correct', () => {
      const query = 'ABC';
      const id = '0';
      const { initialState } = getVariableTestContext(adapter, { id, query });
      const payload = toVariablePayload({ id: '0', type: 'textbox' });

      reducerTester<VariablesState>()
        .givenReducer(textBoxVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createTextBoxOptions(payload))
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
      const id = '0';
      const { initialState } = getVariableTestContext(adapter, { id, query });
      const payload = toVariablePayload({ id: '0', type: 'textbox' });

      reducerTester<VariablesState>()
        .givenReducer(textBoxVariableReducer, cloneDeep(initialState))
        .whenActionIsDispatched(createTextBoxOptions(payload))
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
