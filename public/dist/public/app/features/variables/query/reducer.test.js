import { __assign, __makeTemplateObject } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { metricNamesToVariableValues, queryVariableReducer, sortVariableValues, updateVariableOptions, } from './reducer';
import { VariableSort } from '../types';
import { cloneDeep } from 'lodash';
import { getVariableTestContext } from '../state/helpers';
import { toVariablePayload } from '../state/types';
import { createQueryVariableAdapter } from './adapter';
describe('queryVariableReducer', function () {
    var adapter = createQueryVariableAdapter();
    describe('when updateVariableOptions is dispatched and includeAll is true', function () {
        it('then state should be correct', function () {
            var initialState = getVariableTestContext(adapter, { includeAll: true }).initialState;
            var metrics = [createMetric('A'), createMetric('B')];
            var update = { results: metrics, templatedRegex: '' };
            var payload = toVariablePayload({ id: '0', type: 'query' }, update);
            reducerTester()
                .givenReducer(queryVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateVariableOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [
                        { text: 'All', value: '$__all', selected: false },
                        { text: 'A', value: 'A', selected: false },
                        { text: 'B', value: 'B', selected: false },
                    ] }) }));
        });
    });
    describe('when updateVariableOptions is dispatched and includeAll is false', function () {
        it('then state should be correct', function () {
            var initialState = getVariableTestContext(adapter, { includeAll: false }).initialState;
            var metrics = [createMetric('A'), createMetric('B')];
            var update = { results: metrics, templatedRegex: '' };
            var payload = toVariablePayload({ id: '0', type: 'query' }, update);
            reducerTester()
                .givenReducer(queryVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateVariableOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [
                        { text: 'A', value: 'A', selected: false },
                        { text: 'B', value: 'B', selected: false },
                    ] }) }));
        });
    });
    describe('when updateVariableOptions is dispatched and includeAll is true and payload is an empty array', function () {
        it('then state should be correct', function () {
            var initialState = getVariableTestContext(adapter, { includeAll: true }).initialState;
            var update = { results: [], templatedRegex: '' };
            var payload = toVariablePayload({ id: '0', type: 'query' }, update);
            reducerTester()
                .givenReducer(queryVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateVariableOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [{ text: 'All', value: '$__all', selected: false }] }) }));
        });
    });
    describe('when updateVariableOptions is dispatched and includeAll is false and payload is an empty array', function () {
        it('then state should be correct', function () {
            var initialState = getVariableTestContext(adapter, { includeAll: false }).initialState;
            var update = { results: [], templatedRegex: '' };
            var payload = toVariablePayload({ id: '0', type: 'query' }, update);
            reducerTester()
                .givenReducer(queryVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateVariableOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [{ text: 'None', value: '', selected: false, isNone: true }] }) }));
        });
    });
    describe('when updateVariableOptions is dispatched and includeAll is true and regex is set', function () {
        it('then state should be correct', function () {
            var regex = '/.*(a).*/i';
            var initialState = getVariableTestContext(adapter, { includeAll: true, regex: regex }).initialState;
            var metrics = [createMetric('A'), createMetric('B')];
            var update = { results: metrics, templatedRegex: regex };
            var payload = toVariablePayload({ id: '0', type: 'query' }, update);
            reducerTester()
                .givenReducer(queryVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateVariableOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [
                        { text: 'All', value: '$__all', selected: false },
                        { text: 'A', value: 'A', selected: false },
                    ] }) }));
        });
    });
    describe('when updateVariableOptions is dispatched and includeAll is false and regex is set', function () {
        it('then state should be correct', function () {
            var regex = '/.*(a).*/i';
            var initialState = getVariableTestContext(adapter, { includeAll: false, regex: regex }).initialState;
            var metrics = [createMetric('A'), createMetric('B')];
            var update = { results: metrics, templatedRegex: regex };
            var payload = toVariablePayload({ id: '0', type: 'query' }, update);
            reducerTester()
                .givenReducer(queryVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateVariableOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [{ text: 'A', value: 'A', selected: false }] }) }));
        });
    });
    describe('when updateVariableOptions is dispatched and includeAll is false and regex is set and uses capture groups', function () {
        it('normal regex should capture in order matches', function () {
            var regex = '/somelabel="(?<text>[^"]+).*somevalue="(?<value>[^"]+)/i';
            var initialState = getVariableTestContext(adapter, { includeAll: false, regex: regex }).initialState;
            var metrics = [createMetric('A{somelabel="atext",somevalue="avalue"}'), createMetric('B')];
            var update = { results: metrics, templatedRegex: regex };
            var payload = toVariablePayload({ id: '0', type: 'query' }, update);
            reducerTester()
                .givenReducer(queryVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateVariableOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [{ text: 'atext', value: 'avalue', selected: false }] }) }));
        });
        it('global regex should capture out of order matches', function () {
            var regex = '/somevalue="(?<value>[^"]+)|somelabel="(?<text>[^"]+)/gi';
            var initialState = getVariableTestContext(adapter, { includeAll: false, regex: regex }).initialState;
            var metrics = [createMetric('A{somelabel="atext",somevalue="avalue"}'), createMetric('B')];
            var update = { results: metrics, templatedRegex: regex };
            var payload = toVariablePayload({ id: '0', type: 'query' }, update);
            reducerTester()
                .givenReducer(queryVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateVariableOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [{ text: 'atext', value: 'avalue', selected: false }] }) }));
        });
        it('unmatched text capture will use value capture', function () {
            var regex = '/somevalue="(?<value>[^"]+)|somelabel="(?<text>[^"]+)/gi';
            var initialState = getVariableTestContext(adapter, { includeAll: false, regex: regex }).initialState;
            var metrics = [createMetric('A{somename="atext",somevalue="avalue"}'), createMetric('B')];
            var update = { results: metrics, templatedRegex: regex };
            var payload = toVariablePayload({ id: '0', type: 'query' }, update);
            reducerTester()
                .givenReducer(queryVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateVariableOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [{ text: 'avalue', value: 'avalue', selected: false }] }) }));
        });
        it('unmatched value capture will use text capture', function () {
            var regex = '/somevalue="(?<value>[^"]+)|somelabel="(?<text>[^"]+)/gi';
            var initialState = getVariableTestContext(adapter, { includeAll: false, regex: regex }).initialState;
            var metrics = [createMetric('A{somelabel="atext",somename="avalue"}'), createMetric('B')];
            var update = { results: metrics, templatedRegex: regex };
            var payload = toVariablePayload({ id: '0', type: 'query' }, update);
            reducerTester()
                .givenReducer(queryVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateVariableOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [{ text: 'atext', value: 'atext', selected: false }] }) }));
        });
        it('unnamed capture group returns any unnamed match', function () {
            var regex = '/.*_(\\w+)\\{/gi';
            var initialState = getVariableTestContext(adapter, { includeAll: false, regex: regex }).initialState;
            var metrics = [createMetric('instance_counter{someother="atext",something="avalue"}'), createMetric('B')];
            var update = { results: metrics, templatedRegex: regex };
            var payload = toVariablePayload({ id: '0', type: 'query' }, update);
            reducerTester()
                .givenReducer(queryVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateVariableOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [{ text: 'counter', value: 'counter', selected: false }] }) }));
        });
        it('unmatched text capture and unmatched value capture returns empty state', function () {
            var regex = '/somevalue="(?<value>[^"]+)|somelabel="(?<text>[^"]+)/gi';
            var initialState = getVariableTestContext(adapter, { includeAll: false, regex: regex }).initialState;
            var metrics = [createMetric('A{someother="atext",something="avalue"}'), createMetric('B')];
            var update = { results: metrics, templatedRegex: regex };
            var payload = toVariablePayload({ id: '0', type: 'query' }, update);
            reducerTester()
                .givenReducer(queryVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(updateVariableOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { '0': __assign(__assign({}, initialState[0]), { options: [{ text: 'None', value: '', selected: false, isNone: true }] }) }));
        });
    });
});
describe('sortVariableValues', function () {
    describe('when using any sortOrder with an option with null as text', function () {
        it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      options                                           | sortOrder                                       | expected\n      ", " | ", "                        | ", "\n      ", " | ", "                 | ", "\n      ", " | ", "                | ", "\n      ", " | ", "                    | ", "\n      ", " | ", "                   | ", "\n      ", " | ", "  | ", "\n      ", " | ", " | ", "\n    "], ["\n      options                                           | sortOrder                                       | expected\n      ", " | ", "                        | ", "\n      ", " | ", "                 | ", "\n      ", " | ", "                | ", "\n      ", " | ", "                    | ", "\n      ", " | ", "                   | ", "\n      ", " | ", "  | ", "\n      ", " | ", " | ", "\n    "])), [{ text: '1' }, { text: null }, { text: '2' }], VariableSort.disabled, [{ text: '1' }, { text: null }, { text: '2' }], [{ text: 'a' }, { text: null }, { text: 'b' }], VariableSort.alphabeticalAsc, [{ text: 'a' }, { text: 'b' }, { text: null }], [{ text: 'a' }, { text: null }, { text: 'b' }], VariableSort.alphabeticalDesc, [{ text: null }, { text: 'b' }, { text: 'a' }], [{ text: '1' }, { text: null }, { text: '2' }], VariableSort.numericalAsc, [{ text: null }, { text: '1' }, { text: '2' }], [{ text: '1' }, { text: null }, { text: '2' }], VariableSort.numericalDesc, [{ text: '2' }, { text: '1' }, { text: null }], [{ text: 'a' }, { text: null }, { text: 'b' }], VariableSort.alphabeticalCaseInsensitiveAsc, [{ text: null }, { text: 'a' }, { text: 'b' }], [{ text: 'a' }, { text: null }, { text: 'b' }], VariableSort.alphabeticalCaseInsensitiveDesc, [{ text: 'b' }, { text: 'a' }, { text: null }])('then it should sort the options correctly without throwing (sortOrder:$sortOrder)', function (_a) {
            var options = _a.options, sortOrder = _a.sortOrder, expected = _a.expected;
            var result = sortVariableValues(options, sortOrder);
            expect(result).toEqual(expected);
        });
    });
});
describe('metricNamesToVariableValues', function () {
    var item = function (str) { return ({ text: str, value: str, selected: false }); };
    var metricsNames = [
        item('go_info{instance="demo.robustperception.io:9090",job="prometheus",version="go1.15.6"} 1 1613047998000'),
        item('go_info{instance="demo.robustperception.io:9091",job="pushgateway",version="go1.15.6"} 1 1613047998000'),
        item('go_info{instance="demo.robustperception.io:9093",job="alertmanager",version="go1.14.4"} 1 1613047998000'),
        item('go_info{instance="demo.robustperception.io:9100",job="node",version="go1.14.4"} 1 1613047998000'),
    ];
    var expected1 = [
        { value: 'demo.robustperception.io:9090', text: 'demo.robustperception.io:9090', selected: false },
        { value: 'demo.robustperception.io:9091', text: 'demo.robustperception.io:9091', selected: false },
        { value: 'demo.robustperception.io:9093', text: 'demo.robustperception.io:9093', selected: false },
        { value: 'demo.robustperception.io:9100', text: 'demo.robustperception.io:9100', selected: false },
    ];
    var expected2 = [
        { value: 'prometheus', text: 'prometheus', selected: false },
        { value: 'pushgateway', text: 'pushgateway', selected: false },
        { value: 'alertmanager', text: 'alertmanager', selected: false },
        { value: 'node', text: 'node', selected: false },
    ];
    var expected3 = [
        { value: 'demo.robustperception.io:9090', text: 'prometheus', selected: false },
        { value: 'demo.robustperception.io:9091', text: 'pushgateway', selected: false },
        { value: 'demo.robustperception.io:9093', text: 'alertmanager', selected: false },
        { value: 'demo.robustperception.io:9100', text: 'node', selected: false },
    ];
    var expected4 = [
        { value: 'demo.robustperception.io:9090', text: 'demo.robustperception.io:9090', selected: false },
        { value: undefined, text: undefined, selected: false },
        { value: 'demo.robustperception.io:9091', text: 'demo.robustperception.io:9091', selected: false },
        { value: 'demo.robustperception.io:9093', text: 'demo.robustperception.io:9093', selected: false },
        { value: 'demo.robustperception.io:9100', text: 'demo.robustperception.io:9100', selected: false },
    ];
    it.each(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    variableRegEx                                          | expected\n    ", "                                                  | ", "\n    ", "                                         | ", "\n    ", "                                        | ", "\n    ", "                                              | ", "\n    ", "                                             | ", "\n    ", "                                            | ", "\n    ", "                                           | ", "\n    ", "                                           | ", "\n    ", "                                          | ", "\n    ", "                                        | ", "\n    ", "                                       | ", "\n    ", "                                    | ", "\n    ", "                                   | ", "\n    ", "                       | ", "\n    ", "                      | ", "\n    ", "                        | ", "\n    ", "                       | ", "\n    ", "                      | ", "\n    ", "                             | ", "\n    ", "                            | ", "\n    ", "                             | ", "\n    ", "                            | ", "\n    ", "                           | ", "\n    ", "   | ", "\n    ", "  | ", "\n    ", "    | ", "\n    ", "   | ", "\n    ", "  | ", "\n    ", " | ", "\n    ", "   | ", "\n    ", "  | ", "\n  "], ["\n    variableRegEx                                          | expected\n    ", "                                                  | ", "\n    ", "                                         | ", "\n    ", "                                        | ", "\n    ", "                                              | ", "\n    ", "                                             | ", "\n    ", "                                            | ", "\n    ", "                                           | ", "\n    ", "                                           | ", "\n    ", "                                          | ", "\n    ", "                                        | ", "\n    ", "                                       | ", "\n    ", "                                    | ", "\n    ", "                                   | ", "\n    ", "                       | ", "\n    ", "                      | ", "\n    ", "                        | ", "\n    ", "                       | ", "\n    ", "                      | ", "\n    ", "                             | ", "\n    ", "                            | ", "\n    ", "                             | ", "\n    ", "                            | ", "\n    ", "                           | ", "\n    ", "   | ", "\n    ", "  | ", "\n    ", "    | ", "\n    ", "   | ", "\n    ", "  | ", "\n    ", " | ", "\n    ", "   | ", "\n    ", "  | ", "\n  "])), '', metricsNames, '/unknown/', [], '/unknown/g', [], '/go/', metricsNames, '/go/g', metricsNames, '/(go)/', [{ value: 'go', text: 'go', selected: false }], '/(go)/g', [{ value: 'go', text: 'go', selected: false }], '/(go)?/', [{ value: 'go', text: 'go', selected: false }], '/(go)?/g', [{ value: 'go', text: 'go', selected: false }, { value: undefined, text: undefined, selected: false }], '/go(\\w+)/', [{ value: '_info', text: '_info', selected: false }], '/go(\\w+)/g', [{ value: '_info', text: '_info', selected: false }, { value: '1', text: '1', selected: false }], '/.*_(\\w+)\\{/', [{ value: 'info', text: 'info', selected: false }], '/.*_(\\w+)\\{/g', [{ value: 'info', text: 'info', selected: false }], '/instance="(?<value>[^"]+)/', expected1, '/instance="(?<value>[^"]+)/g', expected1, '/instance="(?<grp1>[^"]+)/', expected1, '/instance="(?<grp1>[^"]+)/g', expected1, '/instancee="(?<value>[^"]+)/', [], '/job="(?<text>[^"]+)/', expected2, '/job="(?<text>[^"]+)/g', expected2, '/job="(?<grp2>[^"]+)/', expected2, '/job="(?<grp2>[^"]+)/g', expected2, '/jobb="(?<text>[^"]+)/g', [], '/instance="(?<value>[^"]+)|job="(?<text>[^"]+)/', expected1, '/instance="(?<value>[^"]+)|job="(?<text>[^"]+)/g', expected3, '/instance="(?<grp1>[^"]+)|job="(?<grp2>[^"]+)/', expected1, '/instance="(?<grp1>[^"]+)|job="(?<grp2>[^"]+)/g', expected4, '/instance="(?<value>[^"]+).*job="(?<text>[^"]+)/', expected3, '/instance="(?<value>[^"]+).*job="(?<text>[^"]+)/g', expected3, '/instance="(?<grp1>[^"]+).*job="(?<grp2>[^"]+)/', expected1, '/instance="(?<grp1>[^"]+).*job="(?<grp2>[^"]+)/g', expected1)('when called with variableRegEx:$variableRegEx then it return correct options', function (_a) {
        var variableRegEx = _a.variableRegEx, expected = _a.expected;
        var result = metricNamesToVariableValues(variableRegEx, VariableSort.disabled, metricsNames);
        expect(result).toEqual(expected);
    });
});
function createMetric(value) {
    return {
        text: value,
    };
}
var templateObject_1, templateObject_2;
//# sourceMappingURL=reducer.test.js.map