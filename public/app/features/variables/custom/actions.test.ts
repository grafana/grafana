import { variableAdapters } from '../adapters';
import { updateCustomVariableOptions } from './actions';
import { createCustomVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { getRootReducer, RootReducerType } from '../state/helpers';
import { CustomVariableModel, initialVariableModelState, VariableOption } from '../types';
import { addVariable, setCurrentVariableValue } from '../state/sharedReducer';
import { createCustomOptionsFromQuery } from './reducer';
import { toKeyedAction } from '../state/dashboardVariablesReducer';
import { toDashboardVariableIdentifier, toVariablePayload } from '../utils';

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
        dashboardUid: 'uid',
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
          toKeyedAction('uid', addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        )
        .whenAsyncActionIsDispatched(updateCustomVariableOptions(toDashboardVariableIdentifier(variable)), true);

      tester.thenDispatchedActionsShouldEqual(
        toKeyedAction('uid', createCustomOptionsFromQuery(toVariablePayload(variable))),
        toKeyedAction('uid', setCurrentVariableValue(toVariablePayload(variable, { option })))
      );
    });
  });
});
