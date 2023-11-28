import { __awaiter } from "tslib";
import { getMockPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { reduxTester } from '../../../../test/core/redux/reduxTester';
import { variableAdapters } from '../adapters';
import { changeVariableEditorExtended } from '../editor/reducer';
import { datasourceBuilder } from '../shared/testing/builders';
import { getDataSourceInstanceSetting } from '../shared/testing/helpers';
import { getRootReducer } from '../state/helpers';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { addVariable, setCurrentVariableValue } from '../state/sharedReducer';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';
import { initDataSourceVariableEditor, updateDataSourceVariableOptions, } from './actions';
import { createDataSourceVariableAdapter } from './adapter';
import { createDataSourceOptions } from './reducer';
function getTestContext({ sources = [], query, regex } = {}) {
    const getListMock = jest.fn().mockReturnValue(sources);
    const getDatasourceSrvMock = jest.fn().mockReturnValue({ getList: getListMock });
    const dependencies = { getDatasourceSrv: getDatasourceSrvMock };
    const datasource = datasourceBuilder().withId('0').withRootStateKey('key').withQuery(query).withRegEx(regex).build();
    return { getListMock, getDatasourceSrvMock, dependencies, datasource };
}
describe('data source actions', () => {
    variableAdapters.setInit(() => [createDataSourceVariableAdapter()]);
    describe('when updateDataSourceVariableOptions is dispatched', () => {
        describe('and there is no regex', () => {
            it('then the correct actions are dispatched', () => __awaiter(void 0, void 0, void 0, function* () {
                const meta = getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' });
                const sources = [
                    getDataSourceInstanceSetting('first-name', meta),
                    getDataSourceInstanceSetting('second-name', meta),
                ];
                const { datasource, dependencies, getListMock, getDatasourceSrvMock } = getTestContext({
                    sources,
                    query: 'mock-data-id',
                });
                const tester = yield reduxTester()
                    .givenRootReducer(getRootReducer())
                    .whenActionIsDispatched(toKeyedAction('key', addVariable(toVariablePayload(datasource, { global: false, index: 0, model: datasource }))))
                    .whenAsyncActionIsDispatched(updateDataSourceVariableOptions(toKeyedVariableIdentifier(datasource), dependencies), true);
                tester.thenDispatchedActionsShouldEqual(toKeyedAction('key', createDataSourceOptions(toVariablePayload({ type: 'datasource', id: '0' }, {
                    sources,
                    regex: undefined,
                }))), toKeyedAction('key', setCurrentVariableValue(toVariablePayload({ type: 'datasource', id: '0' }, { option: { text: 'first-name', value: 'first-name', selected: false } }))));
                expect(getListMock).toHaveBeenCalledTimes(1);
                expect(getListMock).toHaveBeenCalledWith({ metrics: true, variables: false });
                expect(getDatasourceSrvMock).toHaveBeenCalledTimes(1);
            }));
        });
        describe('and there is a regex', () => {
            it('then the correct actions are dispatched', () => __awaiter(void 0, void 0, void 0, function* () {
                const meta = getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' });
                const sources = [
                    getDataSourceInstanceSetting('first-name', meta),
                    getDataSourceInstanceSetting('second-name', meta),
                ];
                const { datasource, dependencies, getListMock, getDatasourceSrvMock } = getTestContext({
                    sources,
                    query: 'mock-data-id',
                    regex: '/.*(second-name).*/',
                });
                const tester = yield reduxTester()
                    .givenRootReducer(getRootReducer())
                    .whenActionIsDispatched(toKeyedAction('key', addVariable(toVariablePayload(datasource, { global: false, index: 0, model: datasource }))))
                    .whenAsyncActionIsDispatched(updateDataSourceVariableOptions(toKeyedVariableIdentifier(datasource), dependencies), true);
                tester.thenDispatchedActionsShouldEqual(toKeyedAction('key', createDataSourceOptions(toVariablePayload({ type: 'datasource', id: '0' }, {
                    sources,
                    regex: /.*(second-name).*/,
                }))), toKeyedAction('key', setCurrentVariableValue(toVariablePayload({ type: 'datasource', id: '0' }, { option: { text: 'second-name', value: 'second-name', selected: false } }))));
                expect(getListMock).toHaveBeenCalledTimes(1);
                expect(getListMock).toHaveBeenCalledWith({ metrics: true, variables: false });
                expect(getDatasourceSrvMock).toHaveBeenCalledTimes(1);
            }));
        });
    });
    describe('when initDataSourceVariableEditor is dispatched', () => {
        it('then the correct actions are dispatched', () => {
            const meta = getMockPlugin({ name: 'mock-data-name', id: 'mock-data-id' });
            const sources = [
                getDataSourceInstanceSetting('first-name', meta),
                getDataSourceInstanceSetting('second-name', meta),
            ];
            const { dependencies, getListMock, getDatasourceSrvMock } = getTestContext({ sources });
            reduxTester()
                .givenRootReducer(getRootReducer())
                .whenActionIsDispatched(initDataSourceVariableEditor('key', dependencies))
                .thenDispatchedActionsShouldEqual(toKeyedAction('key', changeVariableEditorExtended({
                dataSourceTypes: [
                    { text: '', value: '' },
                    { text: 'mock-data-name', value: 'mock-data-id' },
                ],
            })));
            expect(getListMock).toHaveBeenCalledTimes(1);
            expect(getListMock).toHaveBeenCalledWith({ metrics: true, variables: true });
            expect(getDatasourceSrvMock).toHaveBeenCalledTimes(1);
        });
    });
});
//# sourceMappingURL=actions.test.js.map