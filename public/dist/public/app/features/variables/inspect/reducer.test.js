import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialVariableInspectState, initInspect, variableInspectReducer } from './reducer';
import { textboxBuilder } from '../shared/testing/builders';
describe('variableInspectReducer', function () {
    describe('when initInspect is dispatched', function () {
        it('then state should be correct', function () {
            var variable = textboxBuilder().withId('text').withName('text').build();
            reducerTester()
                .givenReducer(variableInspectReducer, __assign({}, initialVariableInspectState))
                .whenActionIsDispatched(initInspect({
                unknownExits: true,
                unknownsNetwork: [{ edges: [], nodes: [], showGraph: true, variable: variable }],
                usagesNetwork: [{ edges: [], nodes: [], showGraph: true, variable: variable }],
                usages: [{ variable: variable, tree: {} }],
                unknown: [{ variable: variable, tree: {} }],
            }))
                .thenStateShouldEqual({
                unknownExits: true,
                unknownsNetwork: [{ edges: [], nodes: [], showGraph: true, variable: variable }],
                usagesNetwork: [{ edges: [], nodes: [], showGraph: true, variable: variable }],
                usages: [{ variable: variable, tree: {} }],
                unknown: [{ variable: variable, tree: {} }],
            });
        });
    });
});
//# sourceMappingURL=reducer.test.js.map