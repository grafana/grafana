import { __assign, __makeTemplateObject } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { createDataSourceOptions, dataSourceVariableReducer } from './reducer';
import { getVariableTestContext } from '../state/helpers';
import { cloneDeep } from 'lodash';
import { createDataSourceVariableAdapter } from './adapter';
import { toVariablePayload } from '../state/types';
import { getMockPlugins } from '../../plugins/__mocks__/pluginMocks';
import { getDataSourceInstanceSetting } from '../shared/testing/helpers';
describe('dataSourceVariableReducer', function () {
    var adapter = createDataSourceVariableAdapter();
    describe('when createDataSourceOptions is dispatched', function () {
        var plugins = getMockPlugins(3);
        var sources = plugins.map(function (p) { return getDataSourceInstanceSetting(p.name, p); });
        it.each(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      query                 | regex                           | includeAll | expected\n      ", " | ", "                    | ", "   | ", "\n      ", " | ", "                    | ", "   | ", "\n      ", " | ", " | ", "   | ", "\n      ", " | ", " | ", "   | ", "\n      ", " | ", "                    | ", "    | ", "\n      ", " | ", "                    | ", "    | ", "\n      ", " | ", " | ", "    | ", "\n      ", " | ", " | ", "    | ", "\n    "], ["\n      query                 | regex                           | includeAll | expected\n      ", " | ", "                    | ", "   | ", "\n      ", " | ", "                    | ", "   | ", "\n      ", " | ", " | ", "   | ", "\n      ", " | ", " | ", "   | ", "\n      ", " | ", "                    | ", "    | ", "\n      ", " | ", "                    | ", "    | ", "\n      ", " | ", " | ", "    | ", "\n      ", " | ", " | ", "    | ", "\n    "])), sources[1].meta.id, undefined, false, [{ text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false }], 'not-found-plugin', undefined, false, [{ text: 'No data sources found', value: '', selected: false }], sources[1].meta.id, /.*(pretty cool plugin-1).*/, false, [{ text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false }], sources[1].meta.id, /.*(pretty cool plugin-2).*/, false, [{ text: 'No data sources found', value: '', selected: false }], sources[1].meta.id, undefined, true, [{ text: 'All', value: '$__all', selected: false }, { text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false }], 'not-found-plugin', undefined, true, [{ text: 'All', value: '$__all', selected: false }, { text: 'No data sources found', value: '', selected: false }], sources[1].meta.id, /.*(pretty cool plugin-1).*/, true, [{ text: 'All', value: '$__all', selected: false }, { text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false }], sources[1].meta.id, /.*(pretty cool plugin-2).*/, true, [{ text: 'All', value: '$__all', selected: false }, { text: 'No data sources found', value: '', selected: false }])("when called with query: '$query' and regex: '$regex' and includeAll: '$includeAll' then state should be correct", function (_a) {
            var _b;
            var query = _a.query, regex = _a.regex, includeAll = _a.includeAll, expected = _a.expected;
            var initialState = getVariableTestContext(adapter, { query: query, includeAll: includeAll }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'datasource' }, { sources: sources, regex: regex });
            reducerTester()
                .givenReducer(dataSourceVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createDataSourceOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), (_b = {}, _b['0'] = __assign(__assign({}, initialState['0']), { options: expected }), _b)));
        });
    });
    describe('when createDataSourceOptions is dispatched and item is default data source', function () {
        it('then the state should include an extra default option', function () {
            var _a;
            var plugins = getMockPlugins(3);
            var sources = plugins.map(function (p) { return getDataSourceInstanceSetting(p.name, p); });
            sources[1].isDefault = true;
            var initialState = getVariableTestContext(adapter, {
                query: sources[1].meta.id,
                includeAll: false,
            }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'datasource' }, { sources: sources, regex: undefined });
            reducerTester()
                .givenReducer(dataSourceVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createDataSourceOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), (_a = {}, _a['0'] = __assign(__assign({}, initialState['0']), { options: [
                    { text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false },
                    { text: 'default', value: 'default', selected: false },
                ] }), _a)));
        });
    });
    describe('when createDataSourceOptions is dispatched with default in the regex and item is default data source', function () {
        it('then the state should include an extra default option', function () {
            var _a;
            var plugins = getMockPlugins(3);
            var sources = plugins.map(function (p) { return getDataSourceInstanceSetting(p.name, p); });
            sources[1].isDefault = true;
            var initialState = getVariableTestContext(adapter, {
                query: sources[1].meta.id,
                includeAll: false,
            }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'datasource' }, { sources: sources, regex: /default/ });
            reducerTester()
                .givenReducer(dataSourceVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createDataSourceOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), (_a = {}, _a['0'] = __assign(__assign({}, initialState['0']), { options: [{ text: 'default', value: 'default', selected: false }] }), _a)));
        });
    });
    describe('when createDataSourceOptions is dispatched without default in the regex and item is default data source', function () {
        it('then the state not should include an extra default option', function () {
            var _a;
            var plugins = getMockPlugins(3);
            var sources = plugins.map(function (p) { return getDataSourceInstanceSetting(p.name, p); });
            sources[1].isDefault = true;
            var initialState = getVariableTestContext(adapter, {
                query: sources[1].meta.id,
                includeAll: false,
            }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'datasource' }, { sources: sources, regex: /pretty/ });
            reducerTester()
                .givenReducer(dataSourceVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createDataSourceOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), (_a = {}, _a['0'] = __assign(__assign({}, initialState['0']), { options: [{ text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false }] }), _a)));
        });
    });
    describe('when createDataSourceOptions is dispatched without the regex and item is default data source', function () {
        it('then the state should include an extra default option', function () {
            var _a;
            var plugins = getMockPlugins(3);
            var sources = plugins.map(function (p) { return getDataSourceInstanceSetting(p.name, p); });
            sources[1].isDefault = true;
            var initialState = getVariableTestContext(adapter, {
                query: sources[1].meta.id,
                includeAll: false,
            }).initialState;
            var payload = toVariablePayload({ id: '0', type: 'datasource' }, { sources: sources, regex: undefined });
            reducerTester()
                .givenReducer(dataSourceVariableReducer, cloneDeep(initialState))
                .whenActionIsDispatched(createDataSourceOptions(payload))
                .thenStateShouldEqual(__assign(__assign({}, initialState), (_a = {}, _a['0'] = __assign(__assign({}, initialState['0']), { options: [
                    { text: 'pretty cool plugin-1', value: 'pretty cool plugin-1', selected: false },
                    { text: 'default', value: 'default', selected: false },
                ] }), _a)));
        });
    });
});
var templateObject_1;
//# sourceMappingURL=reducer.test.js.map