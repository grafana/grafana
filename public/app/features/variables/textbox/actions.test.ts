import { variableAdapters } from '../adapters';
import { createTextBoxVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/variables/state/reducers';
import { updateTextBoxVariableOptions } from './actions';
import { getRootReducer } from '../state/helpers';
import { TextBoxVariableModel, VariableHide, VariableOption } from '../../templating/types';
import { toVariablePayload } from '../state/types';
import { createTextBoxOptions } from './reducer';
import { addVariable, setCurrentVariableValue } from '../state/sharedReducer';
import { updateLocation } from 'app/core/actions';
import { setVariablesDashboardUid } from '../state/dashboardIdReducer';

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
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(setVariablesDashboardUid({ uid: undefined }))
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenAsyncActionIsDispatched(updateTextBoxVariableOptions(toVariablePayload(variable)), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [createAction, setCurrentAction, locationAction] = actions;
        const expectedNumberOfActions = 3;

        expect(createAction).toEqual(createTextBoxOptions(toVariablePayload(variable)));
        expect(setCurrentAction).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        expect(locationAction).toEqual(updateLocation({ query: { 'var-textbox': 'A' } }));

        return actions.length === expectedNumberOfActions;
      });
    });
  });
});
