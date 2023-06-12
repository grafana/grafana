import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { textboxBuilder } from '../shared/testing/builders';

import { initialVariableInspectState, initInspect, variableInspectReducer, VariableInspectState } from './reducer';

describe('variableInspectReducer', () => {
  describe('when initInspect is dispatched', () => {
    it('then state should be correct', () => {
      const variable = textboxBuilder().withId('text').withName('text').build();
      reducerTester<VariableInspectState>()
        .givenReducer(variableInspectReducer, { ...initialVariableInspectState })
        .whenActionIsDispatched(
          initInspect({
            usagesNetwork: [{ edges: [], nodes: [], showGraph: true, variable }],
            usages: [{ variable, tree: {} }],
          })
        )
        .thenStateShouldEqual({
          usagesNetwork: [{ edges: [], nodes: [], showGraph: true, variable }],
          usages: [{ variable, tree: {} }],
        });
    });
  });
});
