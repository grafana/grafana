import { createSlice } from '@reduxjs/toolkit';
import { defaultDashboard } from '@grafana/schema';
import { processAclItems } from 'app/core/utils/acl';
import { DashboardInitPhase } from 'app/types';
import { DashboardModel } from './DashboardModel';
export const initialState = {
    initPhase: DashboardInitPhase.NotStarted,
    getModel: () => null,
    permissions: [],
    initError: null,
    initialDatasource: undefined,
};
const dashboardSlice = createSlice({
    name: 'dashboard',
    initialState,
    reducers: {
        loadDashboardPermissions: (state, action) => {
            state.permissions = processAclItems(action.payload);
        },
        dashboardInitFetching: (state) => {
            state.initPhase = DashboardInitPhase.Fetching;
        },
        dashboardInitServices: (state) => {
            state.initPhase = DashboardInitPhase.Services;
        },
        dashboardInitCompleted: (state, action) => {
            state.getModel = () => action.payload;
            state.initPhase = DashboardInitPhase.Completed;
        },
        dashboardInitFailed: (state, action) => {
            state.initPhase = DashboardInitPhase.Failed;
            state.initError = action.payload;
            state.getModel = () => {
                return new DashboardModel(Object.assign(Object.assign({}, defaultDashboard), { title: 'Dashboard init failed' }), { canSave: false, canEdit: false });
            };
        },
        cleanUpDashboard: (state) => {
            state.initPhase = DashboardInitPhase.NotStarted;
            state.initError = null;
            state.getModel = () => null;
        },
        addPanel: (state, action) => {
            //state.panels[action.payload.id] = { pluginId: action.payload.type };
        },
        setInitialDatasource: (state, action) => {
            state.initialDatasource = action.payload;
        },
    },
});
export const { loadDashboardPermissions, dashboardInitFetching, dashboardInitFailed, dashboardInitCompleted, dashboardInitServices, cleanUpDashboard, addPanel, setInitialDatasource, } = dashboardSlice.actions;
export const dashboardReducer = dashboardSlice.reducer;
export default {
    dashboard: dashboardReducer,
};
//# sourceMappingURL=reducers.js.map