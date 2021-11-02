import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { cloneDeep } from 'lodash';
import { getVariableTestContext } from '../state/helpers';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE, toVariablePayload } from '../state/types';
import { createCustomOptionsFromQuery, customVariableReducer } from './reducer';
import { createCustomVariableAdapter } from './adapter';
describe('customVariableReducer', function () {
    var adapter = createCustomVariableAdapter();
    describe('when createCustomOptionsFromQuery is dispatched with key/value syntax', function () {
        it('should then mutate state correctly', function () {
            var _a;
            var query = 'a,b,c,d : e';
            var id = '0';
            var initialState = getVariableTestContext(adapter, { id: id, query: query }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'custom' });
            reducerTester()
                .givenReducer(customVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { options: [
                        {
                            text: 'a',
                            value: 'a',
                            selected: false,
                        },
                        {
                            text: 'b',
                            value: 'b',
                            selected: false,
                        },
                        {
                            text: 'c',
                            value: 'c',
                            selected: false,
                        },
                        {
                            text: 'd',
                            value: 'e',
                            selected: false,
                        },
                    ] }),
                _a));
        });
    });
    describe('when createCustomOptionsFromQuery is dispatched without key/value syntax', function () {
        it('should then mutate state correctly', function () {
            var _a;
            var query = 'a,b,c,d:e';
            var id = '0';
            var initialState = getVariableTestContext(adapter, { id: id, query: query }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'custom' });
            reducerTester()
                .givenReducer(customVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { options: [
                        {
                            text: 'a',
                            value: 'a',
                            selected: false,
                        },
                        {
                            text: 'b',
                            value: 'b',
                            selected: false,
                        },
                        {
                            text: 'c',
                            value: 'c',
                            selected: false,
                        },
                        {
                            text: 'd:e',
                            value: 'd:e',
                            selected: false,
                        },
                    ] }),
                _a));
        });
    });
    describe('when createCustomOptionsFromQuery is dispatched and query with key/value syntax contains spaces', function () {
        it('should then mutate state correctly', function () {
            var _a;
            var query = 'a,  b,   c, d : e  ';
            var id = '0';
            var initialState = getVariableTestContext(adapter, { id: id, query: query }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'constant' });
            reducerTester()
                .givenReducer(customVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { options: [
                        {
                            text: 'a',
                            value: 'a',
                            selected: false,
                        },
                        {
                            text: 'b',
                            value: 'b',
                            selected: false,
                        },
                        {
                            text: 'c',
                            value: 'c',
                            selected: false,
                        },
                        {
                            text: 'd',
                            value: 'e',
                            selected: false,
                        },
                    ] }),
                _a));
        });
    });
    describe('when createCustomOptionsFromQuery is dispatched and query without key/value syntax contains spaces', function () {
        it('should then mutate state correctly', function () {
            var _a;
            var query = 'a,  b,   c, d :    e';
            var id = '0';
            var initialState = getVariableTestContext(adapter, { id: id, query: query }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'constant' });
            reducerTester()
                .givenReducer(customVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { options: [
                        {
                            text: 'a',
                            value: 'a',
                            selected: false,
                        },
                        {
                            text: 'b',
                            value: 'b',
                            selected: false,
                        },
                        {
                            text: 'c',
                            value: 'c',
                            selected: false,
                        },
                        {
                            text: 'd',
                            value: 'e',
                            selected: false,
                        },
                    ] }),
                _a));
        });
    });
    describe('when createCustomOptionsFromQuery is dispatched and query without key/value syntax contains urls', function () {
        it('should then mutate state correctly', function () {
            var _a;
            var query = 'a,  b,http://www.google.com/, http://www.amazon.com/';
            var id = '0';
            var initialState = getVariableTestContext(adapter, { id: id, query: query }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'constant' });
            reducerTester()
                .givenReducer(customVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { options: [
                        {
                            text: 'a',
                            value: 'a',
                            selected: false,
                        },
                        {
                            text: 'b',
                            value: 'b',
                            selected: false,
                        },
                        {
                            text: 'http://www.google.com/',
                            value: 'http://www.google.com/',
                            selected: false,
                        },
                        {
                            text: 'http://www.amazon.com/',
                            value: 'http://www.amazon.com/',
                            selected: false,
                        },
                    ] }),
                _a));
        });
    });
    describe('when createCustomOptionsFromQuery is dispatched and query with key/value syntax contains urls', function () {
        it('should then mutate state correctly', function () {
            var _a;
            var query = 'a,  b, google : http://www.google.com/, amazon : http://www.amazon.com/';
            var id = '0';
            var initialState = getVariableTestContext(adapter, { id: id, query: query }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'constant' });
            reducerTester()
                .givenReducer(customVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { options: [
                        {
                            text: 'a',
                            value: 'a',
                            selected: false,
                        },
                        {
                            text: 'b',
                            value: 'b',
                            selected: false,
                        },
                        {
                            text: 'google',
                            value: 'http://www.google.com/',
                            selected: false,
                        },
                        {
                            text: 'amazon',
                            value: 'http://www.amazon.com/',
                            selected: false,
                        },
                    ] }),
                _a));
        });
    });
    describe('when createCustomOptionsFromQuery is dispatched and includeAll is true', function () {
        it('should then mutate state correctly', function () {
            var _a;
            var query = 'a,b,c,d : e';
            var id = '0';
            var initialState = getVariableTestContext(adapter, { id: id, query: query, includeAll: true }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'constant' });
            reducerTester()
                .givenReducer(customVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createCustomOptionsFromQuery(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { options: [
                        {
                            text: ALL_VARIABLE_TEXT,
                            value: ALL_VARIABLE_VALUE,
                            selected: false,
                        },
                        {
                            text: 'a',
                            value: 'a',
                            selected: false,
                        },
                        {
                            text: 'b',
                            value: 'b',
                            selected: false,
                        },
                        {
                            text: 'c',
                            value: 'c',
                            selected: false,
                        },
                        {
                            text: 'd',
                            value: 'e',
                            selected: false,
                        },
                    ] }),
                _a));
        });
    });
});
//# sourceMappingURL=reducer.test.js.map