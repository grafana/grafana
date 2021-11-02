import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { cloneDeep } from 'lodash';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { createTextBoxOptions, textBoxVariableReducer } from './reducer';
import { createTextBoxVariableAdapter } from './adapter';
describe('textBoxVariableReducer', function () {
    var adapter = createTextBoxVariableAdapter();
    describe('when createTextBoxOptions is dispatched', function () {
        it('then state should be correct', function () {
            var _a;
            var query = 'ABC';
            var id = '0';
            var initialState = getVariableTestContext(adapter, { id: id, query: query }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'textbox' });
            reducerTester()
                .givenReducer(textBoxVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createTextBoxOptions(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { options: [
                        {
                            text: query,
                            value: query,
                            selected: false,
                        },
                    ], current: {
                        text: query,
                        value: query,
                        selected: false,
                    } }),
                _a));
        });
    });
    describe('when createTextBoxOptions is dispatched and query contains spaces', function () {
        it('then state should be correct', function () {
            var _a;
            var query = '  ABC  ';
            var id = '0';
            var initialState = getVariableTestContext(adapter, { id: id, query: query }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'textbox' });
            reducerTester()
                .givenReducer(textBoxVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createTextBoxOptions(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { options: [
                        {
                            text: query.trim(),
                            value: query.trim(),
                            selected: false,
                        },
                    ], current: {
                        text: query.trim(),
                        value: query.trim(),
                        selected: false,
                    } }),
                _a));
        });
    });
});
//# sourceMappingURL=reducer.test.js.map