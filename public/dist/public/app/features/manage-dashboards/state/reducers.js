var _a;
import { __assign } from "tslib";
import { createSlice } from '@reduxjs/toolkit';
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
    LibraryPanelInputState["Exits"] = "exists";
    LibraryPanelInputState["Different"] = "different";
})(LibraryPanelInputState || (LibraryPanelInputState = {}));
export var initialImportDashboardState = {
    meta: { updatedAt: '', orgName: '' },
    dashboard: {},
    source: DashboardSource.Json,
    inputs: {},
    isLoaded: false,
};
var importDashboardSlice = createSlice({
    name: 'manageDashboards',
    initialState: initialImportDashboardState,
    reducers: {
        setGcomDashboard: function (state, action) {
            state.dashboard = __assign(__assign({}, action.payload.json), { id: null });
            state.meta = { updatedAt: action.payload.updatedAt, orgName: action.payload.orgName };
            state.source = DashboardSource.Gcom;
            state.isLoaded = true;
        },
        setJsonDashboard: function (state, action) {
            state.dashboard = __assign(__assign({}, action.payload), { id: null });
            state.meta = initialImportDashboardState.meta;
            state.source = DashboardSource.Json;
            state.isLoaded = true;
        },
        clearDashboard: function (state) {
            state.dashboard = {};
            state.isLoaded = false;
        },
        setInputs: function (state, action) {
            state.inputs = {
                dataSources: action.payload.filter(function (p) { return p.type === InputType.DataSource; }),
                constants: action.payload.filter(function (p) { return p.type === InputType.Constant; }),
                libraryPanels: [],
            };
        },
        setLibraryPanelInputs: function (state, action) {
            state.inputs.libraryPanels = action.payload;
        },
    },
});
export var clearDashboard = (_a = importDashboardSlice.actions, _a.clearDashboard), setInputs = _a.setInputs, setGcomDashboard = _a.setGcomDashboard, setJsonDashboard = _a.setJsonDashboard, setLibraryPanelInputs = _a.setLibraryPanelInputs;
export var importDashboardReducer = importDashboardSlice.reducer;
export default {
    importDashboard: importDashboardReducer,
};
//# sourceMappingURL=reducers.js.map