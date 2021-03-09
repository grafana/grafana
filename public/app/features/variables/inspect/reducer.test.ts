import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialVariableInspectState, initInspect, variableInspectReducer } from './reducer';
import { textboxBuilder } from '../shared/testing/builders';

describe('variableInspectReducer', () => {
  describe('when initInspect is dispatched', () => {
    it('then state should be correct', () => {
      const variable = textboxBuilder().withId('text').withName('text').build();
      reducerTester()
        .givenReducer(variableInspectReducer, { ...initialVariableInspectState })
        .whenActionIsDispatched(
          initInspect({
            unknownExits: true,
            unknownsNetwork: [{ edges: [], nodes: [], showGraph: true, variable }],
            usagesNetwork: [{ edges: [], nodes: [], showGraph: true, variable }],
            usages: [{ variable, tree: {} }],
            unknown: [{ variable, tree: {} }],
          })
        )
        .thenStateShouldEqual({
          unknownExits: true,
          unknownsNetwork: [{ edges: [], nodes: [], showGraph: true, variable }],
          usagesNetwork: [{ edges: [], nodes: [], showGraph: true, variable }],
          usages: [{ variable, tree: {} }],
          unknown: [{ variable, tree: {} }],
        });
    });
  });
});
