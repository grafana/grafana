var _a;
import { createSlice } from '@reduxjs/toolkit';
import { DashboardInitPhase, } from 'app/types';
import { processAclItems } from 'app/core/utils/acl';
import { DashboardModel } from './DashboardModel';
export var initialState = {
    initPhase: DashboardInitPhase.NotStarted,
    isInitSlow: false,
    getModel: function () { return null; },
    permissions: [],
    modifiedQueries: null,
    initError: null,
};
var dashbardSlice = createSlice({
    name: 'dashboard',
    initialState: initialState,
    reducers: {
        loadDashboardPermissions: function (state, action) {
            state.permissions = processAclItems(action.payload);
        },
        dashboardInitFetching: function (state) {
            state.initPhase = DashboardInitPhase.Fetching;
        },
        dashboardInitServices: function (state) {
            state.initPhase = DashboardInitPhase.Services;
        },
        dashboardInitSlow: function (state) {
            state.isInitSlow = true;
        },
        dashboardInitCompleted: function (state, action) {
            state.getModel = function () { return action.payload; };
            state.initPhase = DashboardInitPhase.Completed;
            state.isInitSlow = false;
        },
        dashboardInitFailed: function (state, action) {
            state.initPhase = DashboardInitPhase.Failed;
            state.initError = action.payload;
            state.getModel = function () {
                return new DashboardModel({ title: 'Dashboard init failed' }, { canSave: false, canEdit: false });
            };
        },
        cleanUpDashboard: function (state) {
            state.initPhase = DashboardInitPhase.NotStarted;
            state.isInitSlow = false;
            state.initError = null;
            state.getModel = function () { return null; };
        },
        setDashboardQueriesToUpdateOnLoad: function (state, action) {
            state.modifiedQueries = action.payload;
        },
        clearDashboardQueriesToUpdateOnLoad: function (state) {
            state.modifiedQueries = null;
        },
        addPanel: function (state, action) {
            //state.panels[action.payload.id] = { pluginId: action.payload.type };
        },
    },
});
export var loadDashboardPermissions = (_a = dashbardSlice.actions, _a.loadDashboardPermissions), dashboardInitFetching = _a.dashboardInitFetching, dashboardInitFailed = _a.dashboardInitFailed, dashboardInitSlow = _a.dashboardInitSlow, dashboardInitCompleted = _a.dashboardInitCompleted, dashboardInitServices = _a.dashboardInitServices, cleanUpDashboard = _a.cleanUpDashboard, setDashboardQueriesToUpdateOnLoad = _a.setDashboardQueriesToUpdateOnLoad, clearDashboardQueriesToUpdateOnLoad = _a.clearDashboardQueriesToUpdateOnLoad, addPanel = _a.addPanel;
export var dashboardReducer = dashbardSlice.reducer;
export default {
    dashboard: dashboardReducer,
};
//# sourceMappingURL=reducers.js.map