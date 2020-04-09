import { variableAdapters } from '../adapters';
import { createConstantVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/variables/state/reducers';
import { updateConstantVariableOptions } from './actions';
import { getRootReducer } from '../state/helpers';
import { ConstantVariableModel, VariableHide, VariableOption } from '../../templating/types';
import { toVariablePayload } from '../state/types';
import { createConstantOptionsFromQuery } from './reducer';
import { setCurrentVariableValue, addVariable } from '../state/sharedReducer';

describe('constant actions', () => {
  variableAdapters.setInit(() => [createConstantVariableAdapter()]);

  describe('when updateConstantVariableOptions is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const option: VariableOption = {
        value: 'A',
        text: 'A',
        selected: false,
      };

      const variable: ConstantVariableModel = {
        type: 'constant',
        id: '0',
        global: false,
        current: {
          value: '',
          text: '',
          selected: false,
        },
        options: [],
        query: 'A',
        name: 'Constant',
        label: '',
        hide: VariableHide.dontHide,
        skipUrlSync: false,
        index: 0,
      };

      const tester = await reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getRootReducer())
        .whenActionIsDispatched(addVariable(toVariablePayload(variable, { global: false, index: 0, model: variable })))
        .whenAsyncActionIsDispatched(updateConstantVariableOptions(toVariablePayload(variable)), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [createAction, setCurrentAction] = actions;
        const expectedNumberOfActions = 2;

        expect(createAction).toEqual(createConstantOptionsFromQuery(toVariablePayload(variable)));
        expect(setCurrentAction).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        return actions.length === expectedNumberOfActions;
      });
    });
  });
});
