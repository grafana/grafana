import { variableAdapters } from '../adapters';
import { updateMappingVariableOptions } from './actions';
import { createMappingVariableAdapter } from './adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { getRootReducer } from '../state/helpers';
import { MappingVariableModel, VariableHide, VariableOption } from '../types';
import { toVariablePayload } from '../state/types';
import { addVariable, setCurrentVariableValue } from '../state/sharedReducer';
import { TemplatingState } from '../state/reducers';
import { createMappingOptionsFromQuery } from './reducer';

describe('mapping actions', () => {
  variableAdapters.setInit(() => [createMappingVariableAdapter()]);

  describe('when updateMappingVariableOptions is dispatched', () => {
    it('then correct actions are dispatched', async () => {
      const option: VariableOption = {
        value: 'A',
        text: 'A',
        selected: false,
      };

      const variable: MappingVariableModel = {
        type: 'mapping',
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
        name: 'Mapping',
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
        .whenAsyncActionIsDispatched(updateMappingVariableOptions(toVariablePayload(variable)), true);

      tester.thenDispatchedActionsPredicateShouldEqual(actions => {
        const [createAction, setCurrentAction] = actions;
        const expectedNumberOfActions = 2;

        expect(createAction).toEqual(createMappingOptionsFromQuery(toVariablePayload(variable)));
        expect(setCurrentAction).toEqual(setCurrentVariableValue(toVariablePayload(variable, { option })));
        return actions.length === expectedNumberOfActions;
      });
    });
  });
});
