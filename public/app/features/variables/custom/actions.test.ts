import { variableAdapters } from '../adapters';
import { updateCustomVariableOptions } from './actions';
import { createCustomVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { getRootReducer } from '../state/helpers';
import { CustomVariableModel, VariableHide, VariableOption } from '../../templating/types';
import { toVariablePayload } from '../state/types';
import { setCurrentVariableValue, addVariable } from '../state/sharedReducer';
import { TemplatingState } from '../state/reducers';
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
        type: 'custom',
        id: '0',
        global: false,
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
        name: 'Custom',
        label: '',
        hide: VariableHide.dontHide,
        skipUrlSync: false,
        index: 0,
        multi: true,
        includeAll: false,
      };

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenAsyncActionIsDispatched(updateCustomVariableOptions(toVariablePayload(variable)), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [createAction, setCurrentAction] = actions;
        const expectedNumberOfActions = 2;

        expect(createAction).toEqual(createCustomOptionsFromQuery(toVariablePayload(variable)));
        expect(setCurrentAction).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        return actions.length === expectedNumberOfActions;
      });
    });
  });
});
