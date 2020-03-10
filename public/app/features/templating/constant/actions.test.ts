import { variableAdapters } from '../adapters';
import { createConstantVariableAdapter } from '../constant/adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/templating/state/reducers';
import { updateConstantVariableOptions } from './actions';
import { getTemplatingRootReducer } from '../state/helpers';
import { ConstantVariableModel, VariableOption, VariableHide } from '../variable';
import { toVariablePayload } from '../state/types';
import { createConstantOptionsFromQuery } from './reducer';
import { setCurrentVariableValue } from '../state/sharedReducer';
import { initDashboardTemplating } from '../state/actions';

describe('constant actions', () => {
  variableAdapters.set('constant', createConstantVariableAdapter());

  describe('when updateConstantVariableOptions is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const option: VariableOption = {
        value: 'A',
        text: 'A',
        selected: false,
      };

      const variable: ConstantVariableModel = {
        type: 'constant',
        uuid: '0',
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
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(initDashboardTemplating([variable]))
        .whenAsyncActionIsDispatched(updateConstantVariableOptions(toVariablePayload(variable)), true);

      tester.thenDispatchedActionPredicateShouldEqual(actions => {
        const [createAction, setCurrentAction] = actions;
        const expectedNumberOfActions = 2;

        expect(createAction).toEqual(createConstantOptionsFromQuery(toVariablePayload(variable)));
        expect(setCurrentAction).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        return actions.length === expectedNumberOfActions;
      });
    });
  });
});
