import { __assign } from "tslib";
import { cloneDeep } from 'lodash';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { createIntervalVariableAdapter } from './adapter';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { createIntervalOptions, intervalVariableReducer } from './reducer';
describe('intervalVariableReducer', function () {
    var adapter = createIntervalVariableAdapter();
    describe('when createIntervalOptions is dispatched', function () {
        describe('and auto is false', function () {
            it('then state should be correct', function () {
                var id = '0';
                var query = '1s,1m,1h,1d';
                var auto = false;
                var initialState = getVariableTestContext(adapter, { id: id, query: query, auto: auto }).initialState;
                var payload = toVariablePayload({ id: '0', type: 'interval' });
                reducerTester()
                    .givenReducer(intervalVariableReducer, cloneDeep(initialState))
                    .whenActionIsDispatched(createIntervalOptions(payload))
                    .thenStateShouldEqual({
                    '0': __assign(__assign({}, initialState['0']), { id: '0', query: '1s,1m,1h,1d', auto: false, options: [
                            { text: '1s', value: '1s', selected: false },
                            { text: '1m', value: '1m', selected: false },
                            { text: '1h', value: '1h', selected: false },
                            { text: '1d', value: '1d', selected: false },
                        ] }),
                });
            });
        });
        describe('and auto is true', function () {
            it('then state should be correct', function () {
                var id = '0';
                var query = '1s,1m,1h,1d';
                var auto = true;
                var initialState = getVariableTestContext(adapter, { id: id, query: query, auto: auto }).initialState;
                var payload = toVariablePayload({ id: '0', type: 'interval' });
                reducerTester()
                    .givenReducer(intervalVariableReducer, cloneDeep(initialState))
                    .whenActionIsDispatched(createIntervalOptions(payload))
                    .thenStateShouldEqual({
                    '0': __assign(__assign({}, initialState['0']), { id: '0', query: '1s,1m,1h,1d', auto: true, options: [
                            { text: 'auto', value: '$__auto_interval_0', selected: false },
                            { text: '1s', value: '1s', selected: false },
                            { text: '1m', value: '1m', selected: false },
                            { text: '1h', value: '1h', selected: false },
                            { text: '1d', value: '1d', selected: false },
                        ] }),
                });
            });
        });
        describe('and query contains "', function () {
            it('then state should be correct', function () {
                var id = '0';
                var query = '"kalle, anka","donald, duck"';
                var auto = false;
                var initialState = getVariableTestContext(adapter, { id: id, query: query, auto: auto }).initialState;
                var payload = toVariablePayload({ id: '0', type: 'interval' });
                reducerTester()
                    .givenReducer(intervalVariableReducer, cloneDeep(initialState))
                    .whenActionIsDispatched(createIntervalOptions(payload))
                    .thenStateShouldEqual({
                    '0': __assign(__assign({}, initialState['0']), { id: '0', query: '"kalle, anka","donald, duck"', auto: false, options: [
                            { text: 'kalle, anka', value: 'kalle, anka', selected: false },
                            { text: 'donald, duck', value: 'donald, duck', selected: false },
                        ] }),
                });
            });
        });
        describe("and query contains '", function () {
            it('then state should be correct', function () {
                var id = '0';
                var query = "'kalle, anka','donald, duck'";
                var auto = false;
                var initialState = getVariableTestContext(adapter, { id: id, query: query, auto: auto }).initialState;
                var payload = toVariablePayload({ id: '0', type: 'interval' });
                reducerTester()
                    .givenReducer(intervalVariableReducer, cloneDeep(initialState))
                    .whenActionIsDispatched(createIntervalOptions(payload))
                    .thenStateShouldEqual({
                    '0': __assign(__assign({}, initialState['0']), { id: '0', query: "'kalle, anka','donald, duck'", auto: false, options: [
                            { text: 'kalle, anka', value: 'kalle, anka', selected: false },
                            { text: 'donald, duck', value: 'donald, duck', selected: false },
                        ] }),
                });
            });
        });
    });
});
//# sourceMappingURL=reducer.test.js.map