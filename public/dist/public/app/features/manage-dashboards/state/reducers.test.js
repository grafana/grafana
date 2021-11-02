import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { clearDashboard, DashboardSource, importDashboardReducer, initialImportDashboardState, InputType, LibraryPanelInputState, setGcomDashboard, setInputs, setJsonDashboard, setLibraryPanelInputs, } from './reducers';
describe('importDashboardReducer', function () {
    describe('when setGcomDashboard action is dispatched', function () {
        it('then resulting state should be correct', function () {
            reducerTester()
                .givenReducer(importDashboardReducer, __assign({}, initialImportDashboardState))
                .whenActionIsDispatched(setGcomDashboard({ json: { id: 1, title: 'Imported' }, updatedAt: '2001-01-01', orgName: 'Some Org' }))
                .thenStateShouldEqual(__assign(__assign({}, initialImportDashboardState), { dashboard: {
                    title: 'Imported',
                    id: null,
                }, meta: { updatedAt: '2001-01-01', orgName: 'Some Org' }, source: DashboardSource.Gcom, isLoaded: true }));
        });
    });
    describe('when setJsonDashboard action is dispatched', function () {
        it('then resulting state should be correct', function () {
            reducerTester()
                .givenReducer(importDashboardReducer, __assign(__assign({}, initialImportDashboardState), { source: DashboardSource.Gcom }))
                .whenActionIsDispatched(setJsonDashboard({ id: 1, title: 'Imported' }))
                .thenStateShouldEqual(__assign(__assign({}, initialImportDashboardState), { dashboard: {
                    title: 'Imported',
                    id: null,
                }, source: DashboardSource.Json, isLoaded: true }));
        });
    });
    describe('when clearDashboard action is dispatched', function () {
        it('then resulting state should be correct', function () {
            reducerTester()
                .givenReducer(importDashboardReducer, __assign(__assign({}, initialImportDashboardState), { dashboard: {
                    title: 'Imported',
                    id: null,
                }, isLoaded: true }))
                .whenActionIsDispatched(clearDashboard())
                .thenStateShouldEqual(__assign(__assign({}, initialImportDashboardState), { dashboard: {}, isLoaded: false }));
        });
    });
    describe('when setInputs action is dispatched', function () {
        it('then resulting state should be correct', function () {
            reducerTester()
                .givenReducer(importDashboardReducer, __assign({}, initialImportDashboardState))
                .whenActionIsDispatched(setInputs([
                { type: InputType.DataSource },
                { type: InputType.Constant },
                { type: InputType.LibraryPanel },
                { type: 'temp' },
            ]))
                .thenStateShouldEqual(__assign(__assign({}, initialImportDashboardState), { inputs: {
                    dataSources: [{ type: InputType.DataSource }],
                    constants: [{ type: InputType.Constant }],
                    libraryPanels: [],
                } }));
        });
    });
    describe('when setLibraryPanelInputs action is dispatched', function () {
        it('then resulting state should be correct', function () {
            reducerTester()
                .givenReducer(importDashboardReducer, __assign(__assign({}, initialImportDashboardState), { inputs: {
                    dataSources: [{ type: InputType.DataSource }],
                    constants: [{ type: InputType.Constant }],
                    libraryPanels: [{ model: { uid: 'asasAHSJ' } }],
                } }))
                .whenActionIsDispatched(setLibraryPanelInputs([
                {
                    model: { uid: 'sadjahsdk', name: 'A name', type: 'text' },
                    state: LibraryPanelInputState.Exits,
                },
            ]))
                .thenStateShouldEqual(__assign(__assign({}, initialImportDashboardState), { inputs: {
                    dataSources: [{ type: InputType.DataSource }],
                    constants: [{ type: InputType.Constant }],
                    libraryPanels: [
                        {
                            model: { uid: 'sadjahsdk', name: 'A name', type: 'text' },
                            state: LibraryPanelInputState.Exits,
                        },
                    ],
                } }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map