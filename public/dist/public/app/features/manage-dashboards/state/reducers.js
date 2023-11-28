import { createSlice } from '@reduxjs/toolkit';
import { LoadingState } from '@grafana/data';
export var DashboardSource;
(function (DashboardSource) {
    DashboardSource[DashboardSource["Gcom"] = 0] = "Gcom";
    DashboardSource[DashboardSource["Json"] = 1] = "Json";
})(DashboardSource || (DashboardSource = {}));
export var InputType;
(function (InputType) {
    InputType["DataSource"] = "datasource";
    InputType["Constant"] = "constant";
    InputType["LibraryPanel"] = "libraryPanel";
})(InputType || (InputType = {}));
export var LibraryPanelInputState;
(function (LibraryPanelInputState) {
    LibraryPanelInputState["New"] = "new";
    LibraryPanelInputState["Exists"] = "exists";
    LibraryPanelInputState["Different"] = "different";
})(LibraryPanelInputState || (LibraryPanelInputState = {}));
export const initialImportDashboardState = {
    meta: { updatedAt: '', orgName: '' },
    dashboard: {},
    source: DashboardSource.Json,
    inputs: {},
    state: LoadingState.NotStarted,
};
const importDashboardSlice = createSlice({
    name: 'manageDashboards',
    initialState: initialImportDashboardState,
    reducers: {
        setGcomDashboard: (state, action) => {
            state.dashboard = Object.assign(Object.assign({}, action.payload.json), { id: null });
            state.meta = { updatedAt: action.payload.updatedAt, orgName: action.payload.orgName };
            state.source = DashboardSource.Gcom;
            state.state = LoadingState.Done;
        },
        setJsonDashboard: (state, action) => {
            state.dashboard = Object.assign(Object.assign({}, action.payload), { id: null });
            state.meta = initialImportDashboardState.meta;
            state.source = DashboardSource.Json;
            state.state = LoadingState.Done;
        },
        clearDashboard: (state) => {
            state.dashboard = {};
            state.state = LoadingState.NotStarted;
        },
        setInputs: (state, action) => {
            state.inputs = {
                dataSources: action.payload.filter((p) => p.type === InputType.DataSource),
                constants: action.payload.filter((p) => p.type === InputType.Constant),
                libraryPanels: state.inputs.libraryPanels || [],
            };
        },
        setLibraryPanelInputs: (state, action) => {
            state.inputs.libraryPanels = action.payload;
        },
        fetchFailed: (state) => {
            state.dashboard = {};
            state.state = LoadingState.Error;
        },
        fetchDashboard: (state) => {
            state.state = LoadingState.Loading;
        },
    },
});
export const { clearDashboard, setInputs, setGcomDashboard, setJsonDashboard, setLibraryPanelInputs, fetchFailed, fetchDashboard, } = importDashboardSlice.actions;
export const importDashboardReducer = importDashboardSlice.reducer;
export default {
    importDashboard: importDashboardReducer,
};
//# sourceMappingURL=reducers.js.map