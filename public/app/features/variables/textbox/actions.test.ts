import { variableAdapters } from '../adapters';
import { createTextBoxVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/variables/state/reducers';
import { updateTextBoxVariableOptions } from './actions';
import { getTemplatingRootReducer } from '../state/helpers';
import { TextBoxVariableModel, VariableHide, VariableOption } from '../../templating/types';
import { toVariablePayload } from '../state/types';
import { createTextBoxOptions } from './reducer';
import { setCurrentVariableValue } from '../state/sharedReducer';
import { initDashboardTemplating } from '../state/actions';

describe('textbox actions', () => {
  variableAdapters.setInit(() => [createTextBoxVariableAdapter()]);

  describe('when updateTextBoxVariableOptions is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const option: VariableOption = {
        value: 'A',
        text: 'A',
        selected: false,
      };

      const variable: TextBoxVariableModel = {
        type: 'textbox',
        id: '0',
        global: false,
        current: {
          value: '',
          text: '',
          selected: false,
        },
        options: [],
        query: 'A',
        name: 'textbox',
        label: '',
        hide: VariableHide.dontHide,
        skipUrlSync: false,
        index: 0,
      };

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenAsyncActionIsDispatched(updateTextBoxVariableOptions(toVariablePayload(variable)), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [createAction, setCurrentAction] = actions;
        const expectedNumberOfActions = 2;

        expect(createAction).toEqual(createTextBoxOptions(toVariablePayload(variable)));
        expect(setCurrentAction).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        return actions.length === expectedNumberOfActions;
      });
    });
  });
});
