import { __awaiter, __generator } from "tslib";
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { getRootReducer } from '../state/helpers';
import { toVariableIdentifier, toVariablePayload } from '../state/types';
import { variableAdapters } from '../adapters';
import { createDataSourceVariableAdapter } from './adapter';
import { initDataSourceVariableEditor, updateDataSourceVariableOptions, } from './actions';
import { getMockPlugin } from '../../plugins/__mocks__/pluginMocks';
import { createDataSourceOptions } from './reducer';
import { addVariable, setCurrentVariableValue } from '../state/sharedReducer';
import { changeVariableEditorExtended } from '../editor/reducer';
import { datasourceBuilder } from '../shared/testing/builders';
import { getDataSourceInstanceSetting } from '../shared/testing/helpers';
function getTestContext(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.sources, sources = _c === void 0 ? [] : _c, query = _b.query, regex = _b.regex;
    var getListMock = jest.fn().mockReturnValue(sources);
    var getDatasourceSrvMock = jest.fn().mockReturnValue({ getList: getListMock });
    var dependencies = { getDatasourceSrv: getDatasourceSrvMock };
    var datasource = datasourceBuilder().withId('0').withQuery(query).withRegEx(regex).build();
    return { getListMock: getListMock, getDatasourceSrvMock: getDatasourceSrvMock, dependencies: dependencies, datasource: datasource };
}
describe('data source actions', function () {
    variableAdapters.setInit(function () { return [createDataSourceVariableAdapter()]; });
    describe('when updateDataSourceVariableOptions is dispatched', function () {
        describe('and there is no regex', function () {
            it('then the correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                var meta, sources, _a, datasource, dependencies, getListMock, getDatasourceSrvMock, tester;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            meta = getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' });
                            sources = [
                                getDataSourceInstanceSetting('first-name', meta),
                                getDataSourceInstanceSetting('second-name', meta),
                            ];
                            _a = getTestContext({
                                sources: sources,
                                query: 'mock-data-id',
                            }), datasource = _a.datasource, dependencies = _a.dependencies, getListMock = _a.getListMock, getDatasourceSrvMock = _a.getDatasourceSrvMock;
                            return [4 /*yield*/, reduxTester()
                                    .givenRootReducer(getRootReducer())
                                    .whenActionIsDispatched(addVariable(toVariablePayload(datasource, { global: false, index: 0, model: datasource })))
                                    .whenAsyncActionIsDispatched(updateDataSourceVariableOptions(toVariableIdentifier(datasource), dependencies), true)];
                        case 1:
                            tester = _b.sent();
                            return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(createDataSourceOptions(toVariablePayload({ type: 'datasource', id: '0' }, {
                                    sources: sources,
                                    regex: undefined,
                                })), setCurrentVariableValue(toVariablePayload({ type: 'datasource', id: '0' }, { option: { text: 'first-name', value: 'first-name', selected: false } })))];
                        case 2:
                            _b.sent();
                            expect(getListMock).toHaveBeenCalledTimes(1);
                            expect(getListMock).toHaveBeenCalledWith({ metrics: true, variables: false });
                            expect(getDatasourceSrvMock).toHaveBeenCalledTimes(1);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and there is a regex', function () {
            it('then the correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
                var meta, sources, _a, datasource, dependencies, getListMock, getDatasourceSrvMock, tester;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            meta = getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' });
                            sources = [
                                getDataSourceInstanceSetting('first-name', meta),
                                getDataSourceInstanceSetting('second-name', meta),
                            ];
                            _a = getTestContext({
                                sources: sources,
                                query: 'mock-data-id',
                                regex: '/.*(second-name).*/',
                            }), datasource = _a.datasource, dependencies = _a.dependencies, getListMock = _a.getListMock, getDatasourceSrvMock = _a.getDatasourceSrvMock;
                            return [4 /*yield*/, reduxTester()
                                    .givenRootReducer(getRootReducer())
                                    .whenActionIsDispatched(addVariable(toVariablePayload(datasource, { global: false, index: 0, model: datasource })))
                                    .whenAsyncActionIsDispatched(updateDataSourceVariableOptions(toVariableIdentifier(datasource), dependencies), true)];
                        case 1:
                            tester = _b.sent();
                            return [4 /*yield*/, tester.thenDispatchedActionsShouldEqual(createDataSourceOptions(toVariablePayload({ type: 'datasource', id: '0' }, {
                                    sources: sources,
                                    regex: /.*(second-name).*/,
                                })), setCurrentVariableValue(toVariablePayload({ type: 'datasource', id: '0' }, { option: { text: 'second-name', value: 'second-name', selected: false } })))];
                        case 2:
                            _b.sent();
                            expect(getListMock).toHaveBeenCalledTimes(1);
                            expect(getListMock).toHaveBeenCalledWith({ metrics: true, variables: false });
                            expect(getDatasourceSrvMock).toHaveBeenCalledTimes(1);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('when initDataSourceVariableEditor is dispatched', function () {
        it('then the correct actions are dispatched', function () { return __awaiter(void 0, void 0, void 0, function () {
            var meta, sources, _a, dependencies, getListMock, getDatasourceSrvMock;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        meta = getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' });
                        sources = [
                            getDataSourceInstanceSetting('first-name', meta),
                            getDataSourceInstanceSetting('second-name', meta),
                        ];
                        _a = getTestContext({ sources: sources }), dependencies = _a.dependencies, getListMock = _a.getListMock, getDatasourceSrvMock = _a.getDatasourceSrvMock;
                        return [4 /*yield*/, reduxTester()
                                .givenRootReducer(getRootReducer())
                                .whenActionIsDispatched(initDataSourceVariableEditor(dependencies))
                                .thenDispatchedActionsShouldEqual(changeVariableEditorExtended({
                                propName: 'dataSourceTypes',
                                propValue: [
                                    { text: '', value: '' },
                                    { text: 'mock-data-name', value: 'mock-data-id' },
                                ],
                            }))];
                    case 1:
                        _b.sent();
                        expect(getListMock).toHaveBeenCalledTimes(1);
                        expect(getListMock).toHaveBeenCalledWith({ metrics: true, variables: true });
                        expect(getDatasourceSrvMock).toHaveBeenCalledTimes(1);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=actions.test.js.map