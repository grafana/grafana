import { cloneDeep } from 'lodash';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../utils';
import { createAdHocVariableAdapter } from './adapter';
import { adHocVariableReducer, filterAdded, filterRemoved, filtersRestored, filterUpdated } from './reducer';
describe('adHocVariableReducer', () => {
    const adapter = createAdHocVariableAdapter();
    describe('when filterAdded is dispatched', () => {
        it('then state should be correct', () => {
            const id = '0';
            const { initialState } = getVariableTestContext(adapter, { id });
            const filter = createFilter('a');
            const payload = toVariablePayload({ id, type: 'adhoc' }, filter);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterAdded(payload))
                .thenStateShouldEqual({
                [id]: Object.assign(Object.assign({}, initialState[id]), { filters: [{ value: 'a', operator: '=', key: 'a' }] }),
            });
        });
    });
    describe('when filterAdded is dispatched and filter already exists', () => {
        it('then state should be correct', () => {
            const id = '0';
            const filterA = createFilter('a');
            const filterB = createFilter('b');
            const { initialState } = getVariableTestContext(adapter, { id, filters: [filterA] });
            const payload = toVariablePayload({ id, type: 'adhoc' }, filterB);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterAdded(payload))
                .thenStateShouldEqual({
                [id]: Object.assign(Object.assign({}, initialState[id]), { filters: [
                        { value: 'a', operator: '=', key: 'a' },
                        { value: 'b', operator: '=', key: 'b' },
                    ] }),
            });
        });
    });
    describe('when filterRemoved is dispatched to remove second filter', () => {
        it('then state should be correct', () => {
            const id = '0';
            const filterA = createFilter('a');
            const filterB = createFilter('b');
            const index = 1;
            const { initialState } = getVariableTestContext(adapter, { id, filters: [filterA, filterB] });
            const payload = toVariablePayload({ id, type: 'adhoc' }, index);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterRemoved(payload))
                .thenStateShouldEqual({
                [id]: Object.assign(Object.assign({}, initialState[id]), { filters: [{ value: 'a', operator: '=', key: 'a' }] }),
            });
        });
    });
    describe('when filterRemoved is dispatched to remove first filter', () => {
        it('then state should be correct', () => {
            const id = '0';
            const filterA = createFilter('a');
            const filterB = createFilter('b');
            const index = 0;
            const { initialState } = getVariableTestContext(adapter, { id, filters: [filterA, filterB] });
            const payload = toVariablePayload({ id, type: 'adhoc' }, index);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterRemoved(payload))
                .thenStateShouldEqual({
                [id]: Object.assign(Object.assign({}, initialState[id]), { filters: [{ value: 'b', operator: '=', key: 'b' }] }),
            });
        });
    });
    describe('when filterRemoved is dispatched to all filters', () => {
        it('then state should be correct', () => {
            const id = '0';
            const filterA = createFilter('a');
            const index = 0;
            const { initialState } = getVariableTestContext(adapter, { id, filters: [filterA] });
            const payload = toVariablePayload({ id, type: 'adhoc' }, index);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterRemoved(payload))
                .thenStateShouldEqual({
                [id]: Object.assign(Object.assign({}, initialState[id]), { filters: [] }),
            });
        });
    });
    describe('when filterUpdated is dispatched', () => {
        it('then state should be correct', () => {
            const id = '0';
            const original = createFilter('a');
            const other = createFilter('b');
            const filter = createFilter('aa');
            const index = 1;
            const { initialState } = getVariableTestContext(adapter, { id, filters: [other, original] });
            const payload = toVariablePayload({ id, type: 'adhoc' }, { index, filter });
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterUpdated(payload))
                .thenStateShouldEqual({
                [id]: Object.assign(Object.assign({}, initialState[id]), { filters: [
                        { value: 'b', operator: '=', key: 'b' },
                        { value: 'aa', operator: '=', key: 'aa' },
                    ] }),
            });
        });
    });
    describe('when filterUpdated is dispatched to update operator', () => {
        it('then state should be correct', () => {
            const id = '0';
            const original = createFilter('a');
            const other = createFilter('b');
            const filter = createFilter('aa', '>');
            const index = 1;
            const { initialState } = getVariableTestContext(adapter, { id, filters: [other, original] });
            const payload = toVariablePayload({ id, type: 'adhoc' }, { index, filter });
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filterUpdated(payload))
                .thenStateShouldEqual({
                [id]: Object.assign(Object.assign({}, initialState[id]), { filters: [
                        { value: 'b', operator: '=', key: 'b' },
                        { value: 'aa', operator: '>', key: 'aa' },
                    ] }),
            });
        });
    });
    describe('when filtersRestored is dispatched', () => {
        it('then state should be correct', () => {
            const id = '0';
            const original = [createFilter('a'), createFilter('b')];
            const restored = [createFilter('aa'), createFilter('bb')];
            const { initialState } = getVariableTestContext(adapter, { id, filters: original });
            const payload = toVariablePayload({ id, type: 'adhoc' }, restored);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filtersRestored(payload))
                .thenStateShouldEqual({
                [id]: Object.assign(Object.assign({}, initialState[id]), { filters: [
                        { value: 'aa', operator: '=', key: 'aa' },
                        { value: 'bb', operator: '=', key: 'bb' },
                    ] }),
            });
        });
    });
    describe('when filtersRestored is dispatched on variabel with no filters', () => {
        it('then state should be correct', () => {
            const id = '0';
            const restored = [createFilter('aa'), createFilter('bb')];
            const { initialState } = getVariableTestContext(adapter, { id });
            const payload = toVariablePayload({ id, type: 'adhoc' }, restored);
            reducerTester()
                .givenReducer(adHocVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(filtersRestored(payload))
                .thenStateShouldEqual({
                [id]: Object.assign(Object.assign({}, initialState[id]), { filters: [
                        { value: 'aa', operator: '=', key: 'aa' },
                        { value: 'bb', operator: '=', key: 'bb' },
                    ] }),
            });
        });
    });
});
function createFilter(value, operator = '=') {
    return {
        value,
        operator,
        key: value,
    };
}
//# sourceMappingURL=reducer.test.js.map