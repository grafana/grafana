import { variableAdapters } from '../adapters';
import { createTextBoxVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/templating/state/reducers';
import { updateTextBoxVariableOptions } from './actions';
import { getTemplatingRootReducer } from '../state/helpers';
import { VariableOption, VariableHide, TextBoxVariableModel } from '../variable';
import { toVariablePayload } from '../state/types';
import { createTextBoxOptions } from './reducer';
import { setCurrentVariableValue } from '../state/sharedReducer';
import { initDashboardTemplating } from '../state/actions';

describe('textbox actions', () => {
  variableAdapters.set('textbox', createTextBoxVariableAdapter());

  describe('when updateTextBoxVariableOptions is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const option: VariableOption = {
        value: 'A',
        text: 'A',
        selected: false,
      };

      const variable: TextBoxVariableModel = {
        type: 'textbox',
        uuid: '0',
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

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [createAction, setCurrentAction] = actions;
        const expectedNumberOfActions = 2;

        expect(createAction).toEqual(createTextBoxOptions(toVariablePayload(variable)));
        expect(setCurrentAction).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        return actions.length === expectedNumberOfActions;
      });
    });
  });
});
