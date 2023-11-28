import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { textboxBuilder } from '../shared/testing/builders';
import { initialVariableInspectState, initInspect, variableInspectReducer } from './reducer';
describe('variableInspectReducer', () => {
    describe('when initInspect is dispatched', () => {
        it('then state should be correct', () => {
            const variable = textboxBuilder().withId('text').withName('text').build();
            reducerTester()
                .givenReducer(variableInspectReducer, Object.assign({}, initialVariableInspectState))
                .whenActionIsDispatched(initInspect({
                usagesNetwork: [{ edges: [], nodes: [], showGraph: true, variable }],
                usages: [{ variable, tree: {} }],
            }))
                .thenStateShouldEqual({
                usagesNetwork: [{ edges: [], nodes: [], showGraph: true, variable }],
                usages: [{ variable, tree: {} }],
            });
        });
    });
});
//# sourceMappingURL=reducer.test.js.map