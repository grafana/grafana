import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { variableAdapters } from '../adapters';
import { getRootReducer, RootReducerType } from '../state/helpers';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { addVariable, setCurrentVariableValue } from '../state/sharedReducer';
import { CustomVariableModel, initialVariableModelState, VariableOption } from '../types';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { updateCustomVariableOptions } from './actions';
import { createCustomVariableAdapter } from './adapter';
import { createCustomOptionsFromQuery } from './reducer';

describe('custom actions', () => {
  variableAdapters.setInit(() => [createCustomVariableAdapter()]);

  describe('when updateCustomVariableOptions is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const option: VariableOption = {
        value: 'A',
        text: 'A',
        selected: false,
      };

      const variable: CustomVariableModel = {
        ...initialVariableModelState,
        id: '0',
        rootStateKey: 'key',
        index: 0,
        type: 'custom',
        name: 'Custom',
        current: {
          value: '',
          text: '',
          selected: false,
        },
        options: [
          {
            text: 'A',
            value: 'A',
            selected: false,
          },
          {
            text: 'B',
            value: 'B',
            selected: false,
          },
        ],
        query: 'A,B',
        multi: true,
        includeAll: false,
      };

      const tester = await reduxTester<RootReducerType>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(
          toKeyedAction('key', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenAsyncActionIsDispatched(updateCustomVariableOptions(toKeyedVariableIdentifier(variable)), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('key', createCustomOptionsFromQuery(toVariablePayload(variable))),
        toKeyedAction('key', setCurrentVariableValue(toVariablePayload(variable, { option })))
      );
    });
  });
});
