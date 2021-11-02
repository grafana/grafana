import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { cloneDeep } from 'lodash';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { constantVariableReducer, createConstantOptionsFromQuery } from './reducer';
import { createConstantVariableAdapter } from './adapter';
describe('constantVariableReducer', function () {
    var adapter = createConstantVariableAdapter();
    describe('when createConstantOptionsFromQuery is dispatched', function () {
        it('then state should be correct', function () {
            var _a;
            var query = 'ABC';
            var id = '0';
            var initialState = getVariableTestContext(adapter, { id: id, query: query }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'constant' });
            reducerTester()
                .givenReducer(constantVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createConstantOptionsFromQuery(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { options: [
                        {
                            text: query,
                            value: query,
                            selected: false,
                        },
                    ] }),
                _a));
        });
    });
    describe('when createConstantOptionsFromQuery is dispatched and query contains spaces', function () {
        it('then state should be correct', function () {
            var _a;
            var query = '  ABC  ';
            var id = '0';
            var initialState = getVariableTestContext(adapter, { id: id, query: query }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'constant' });
            reducerTester()
                .givenReducer(constantVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createConstantOptionsFromQuery(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { options: [
                        {
                            text: query.trim(),
                            value: query.trim(),
                            selected: false,
                        },
                    ] }),
                _a));
        });
    });
});
//# sourceMappingURL=reducer.test.js.map