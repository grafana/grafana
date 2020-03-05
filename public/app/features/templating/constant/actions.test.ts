import { variableAdapters } from '../adapters';
import { createConstantVariableAdapter } from '../constant/adapter';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { TemplatingState } from 'app/features/templating/state/reducers';
import { updateConstantVariableOptions } from './actions';
import { VariableIdentifier } from '../state/types';
import { getTemplatingRootReducer } from '../state/helpers';

describe.skip('constant actions', () => {
  describe('when updateConstantVariableOptions is dispatched', () => {
    it('then correct actions are dispatched', () => {
      const identifier = { uuid: '0', type: 'constant' } as VariableIdentifier;
      variableAdapters.set('constant', createConstantVariableAdapter());

      reduxTester<{ templating: TemplatingState }>()
        .givenRootReducer(getTemplatingRootReducer())
        .whenActionIsDispatched(updateConstantVariableOptions(identifier))
        .thenDispatchedActionPredicateShouldEqual(dispatchedActions => {
          expect(dispatchedActions.length).toEqual(2);
          return true;
        });
    });
  });
});
