import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { cloneDeep } from 'lodash';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { adHocVariableReducer, filterAdded, filterRemoved, filtersRestored, filterUpdated } from './reducer';
import { createAdHocVariableAdapter } from './adapter';
describe('adHocVariableReducer', function () {
    var adapter = createAdHocVariableAdapter();
    describe('when filterAdded is dispatched', function () {
        it('then state should be correct', function () {
            var _a;
            var id = '0';
            var initialState = getVariableTestContext(adapter, { id: id }).initialState;
            var filter = createFilter('a');
            var payload = toVariablePayload({ id: id, type: 'adhoc' }, filter);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterAdded(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { filters: [{ value: 'a', operator: '=', condition: '', key: 'a' }] }),
                _a));
        });
    });
    describe('when filterAdded is dispatched and filter already exists', function () {
        it('then state should be correct', function () {
            var _a;
            var id = '0';
            var filterA = createFilter('a');
            var filterB = createFilter('b');
            var initialState = getVariableTestContext(adapter, { id: id, filters: [filterA] }).initialState;
            var payload = toVariablePayload({ id: id, type: 'adhoc' }, filterB);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterAdded(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { filters: [
                        { value: 'a', operator: '=', condition: '', key: 'a' },
                        { value: 'b', operator: '=', condition: '', key: 'b' },
                    ] }),
                _a));
        });
    });
    describe('when filterRemoved is dispatched to remove second filter', function () {
        it('then state should be correct', function () {
            var _a;
            var id = '0';
            var filterA = createFilter('a');
            var filterB = createFilter('b');
            var index = 1;
            var initialState = getVariableTestContext(adapter, { id: id, filters: [filterA, filterB] }).initialState;
            var payload = toVariablePayload({ id: id, type: 'adhoc' }, index);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterRemoved(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { filters: [{ value: 'a', operator: '=', condition: '', key: 'a' }] }),
                _a));
        });
    });
    describe('when filterRemoved is dispatched to remove first filter', function () {
        it('then state should be correct', function () {
            var _a;
            var id = '0';
            var filterA = createFilter('a');
            var filterB = createFilter('b');
            var index = 0;
            var initialState = getVariableTestContext(adapter, { id: id, filters: [filterA, filterB] }).initialState;
            var payload = toVariablePayload({ id: id, type: 'adhoc' }, index);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterRemoved(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { filters: [{ value: 'b', operator: '=', condition: '', key: 'b' }] }),
                _a));
        });
    });
    describe('when filterRemoved is dispatched to all filters', function () {
        it('then state should be correct', function () {
            var _a;
            var id = '0';
            var filterA = createFilter('a');
            var index = 0;
            var initialState = getVariableTestContext(adapter, { id: id, filters: [filterA] }).initialState;
            var payload = toVariablePayload({ id: id, type: 'adhoc' }, index);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterRemoved(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { filters: [] }),
                _a));
        });
    });
    describe('when filterUpdated is dispatched', function () {
        it('then state should be correct', function () {
            var _a;
            var id = '0';
            var original = createFilter('a');
            var other = createFilter('b');
            var filter = createFilter('aa');
            var index = 1;
            var initialState = getVariableTestContext(adapter, { id: id, filters: [other, original] }).initialState;
            var payload = toVariablePayload({ id: id, type: 'adhoc' }, { index: index, filter: filter });
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterUpdated(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { filters: [
                        { value: 'b', operator: '=', condition: '', key: 'b' },
                        { value: 'aa', operator: '=', condition: '', key: 'aa' },
                    ] }),
                _a));
        });
    });
    describe('when filterUpdated is dispatched to update operator', function () {
        it('then state should be correct', function () {
            var _a;
            var id = '0';
            var original = createFilter('a');
            var other = createFilter('b');
            var filter = createFilter('aa', '>');
            var index = 1;
            var initialState = getVariableTestContext(adapter, { id: id, filters: [other, original] }).initialState;
            var payload = toVariablePayload({ id: id, type: 'adhoc' }, { index: index, filter: filter });
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterUpdated(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { filters: [
                        { value: 'b', operator: '=', condition: '', key: 'b' },
                        { value: 'aa', operator: '>', condition: '', key: 'aa' },
                    ] }),
                _a));
        });
    });
    describe('when filtersRestored is dispatched', function () {
        it('then state should be correct', function () {
            var _a;
            var id = '0';
            var original = [createFilter('a'), createFilter('b')];
            var restored = [createFilter('aa'), createFilter('bb')];
            var initialState = getVariableTestContext(adapter, { id: id, filters: original }).initialState;
            var payload = toVariablePayload({ id: id, type: 'adhoc' }, restored);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filtersRestored(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { filters: [
                        { value: 'aa', operator: '=', condition: '', key: 'aa' },
                        { value: 'bb', operator: '=', condition: '', key: 'bb' },
                    ] }),
                _a));
        });
    });
    describe('when filtersRestored is dispatched on variabel with no filters', function () {
        it('then state should be correct', function () {
            var _a;
            var id = '0';
            var restored = [createFilter('aa'), createFilter('bb')];
            var initialState = getVariableTestContext(adapter, { id: id }).initialState;
            var payload = toVariablePayload({ id: id, type: 'adhoc' }, restored);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filtersRestored(payload))
                .thenStateShouldEqual((_a = {},
                _a[id] = __assign(__assign({}, initialState[id]), { filters: [
                        { value: 'aa', operator: '=', condition: '', key: 'aa' },
                        { value: 'bb', operator: '=', condition: '', key: 'bb' },
                    ] }),
                _a));
        });
    });
});
function createFilter(value, operator) {
    if (operator === void 0) { operator = '='; }
    return {
        value: value,
        operator: operator,
        condition: '',
        key: value,
    };
}
//# sourceMappingURL=reducer.test.js.map