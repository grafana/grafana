import { LoadingState } from '@grafana/data';
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { clearDashboard, DashboardSource, importDashboardReducer, initialImportDashboardState, InputType, LibraryPanelInputState, setGcomDashboard, setInputs, setJsonDashboard, setLibraryPanelInputs, } from './reducers';
describe('importDashboardReducer', () => {
    describe('when setGcomDashboard action is dispatched', () => {
        it('then resulting state should be correct', () => {
            reducerTester()
                .givenReducer(importDashboardReducer, Object.assign({}, initialImportDashboardState))
                .whenActionIsDispatched(setGcomDashboard({ json: { id: 1, title: 'Imported' }, updatedAt: '2001-01-01', orgName: 'Some Org' }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialImportDashboardState), { dashboard: {
                    title: 'Imported',
                    id: null,
                }, meta: { updatedAt: '2001-01-01', orgName: 'Some Org' }, source: DashboardSource.Gcom, state: LoadingState.Done }));
        });
    });
    describe('when setJsonDashboard action is dispatched', () => {
        it('then resulting state should be correct', () => {
            reducerTester()
                .givenReducer(importDashboardReducer, Object.assign(Object.assign({}, initialImportDashboardState), { source: DashboardSource.Gcom }))
                .whenActionIsDispatched(setJsonDashboard({ id: 1, title: 'Imported' }))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialImportDashboardState), { dashboard: {
                    title: 'Imported',
                    id: null,
                }, source: DashboardSource.Json, state: LoadingState.Done }));
        });
    });
    describe('when clearDashboard action is dispatched', () => {
        it('then resulting state should be correct', () => {
            reducerTester()
                .givenReducer(importDashboardReducer, Object.assign(Object.assign({}, initialImportDashboardState), { dashboard: {
                    title: 'Imported',
                    id: null,
                }, state: LoadingState.Done }))
                .whenActionIsDispatched(clearDashboard())
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialImportDashboardState), { dashboard: {}, state: LoadingState.NotStarted }));
        });
    });
    describe('when setInputs action is dispatched', () => {
        it('then resulting state should be correct', () => {
            reducerTester()
                .givenReducer(importDashboardReducer, Object.assign({}, initialImportDashboardState))
                .whenActionIsDispatched(setInputs([
                { type: InputType.DataSource },
                { type: InputType.Constant },
                { type: InputType.LibraryPanel },
                { type: 'temp' },
            ]))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialImportDashboardState), { inputs: {
                    dataSources: [{ type: InputType.DataSource }],
                    constants: [{ type: InputType.Constant }],
                    libraryPanels: [],
                } }));
        });
    });
    describe('when setLibraryPanelInputs action is dispatched', () => {
        it('then resulting state should be correct', () => {
            reducerTester()
                .givenReducer(importDashboardReducer, Object.assign(Object.assign({}, initialImportDashboardState), { inputs: {
                    dataSources: [{ type: InputType.DataSource }],
                    constants: [{ type: InputType.Constant }],
                    libraryPanels: [{ model: { uid: 'asasAHSJ' } }],
                } }))
                .whenActionIsDispatched(setLibraryPanelInputs([
                {
                    model: { uid: 'sadjahsdk', name: 'A name', type: 'text' },
                    state: LibraryPanelInputState.Exists,
                },
            ]))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialImportDashboardState), { inputs: {
                    dataSources: [{ type: InputType.DataSource }],
                    constants: [{ type: InputType.Constant }],
                    libraryPanels: [
                        {
                            model: { uid: 'sadjahsdk', name: 'A name', type: 'text' },
                            state: LibraryPanelInputState.Exists,
                        },
                    ],
                } }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map