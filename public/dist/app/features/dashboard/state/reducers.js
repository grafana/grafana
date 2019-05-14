import * as tslib_1 from "tslib";
import { DashboardInitPhase } from 'app/types';
import { loadDashboardPermissions, dashboardInitFetching, dashboardInitSlow, dashboardInitServices, dashboardInitFailed, dashboardInitCompleted, cleanUpDashboard, } from './actions';
import { reducerFactory } from 'app/core/redux';
import { processAclItems } from 'app/core/utils/acl';
import { DashboardModel } from './DashboardModel';
export var initialState = {
    initPhase: DashboardInitPhase.NotStarted,
    isInitSlow: false,
    model: null,
    permissions: [],
};
export var dashboardReducer = reducerFactory(initialState)
    .addMapper({
    filter: loadDashboardPermissions,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, { permissions: processAclItems(action.payload) })); },
})
    .addMapper({
    filter: dashboardInitFetching,
    mapper: function (state) { return (tslib_1.__assign({}, state, { initPhase: DashboardInitPhase.Fetching })); },
})
    .addMapper({
    filter: dashboardInitServices,
    mapper: function (state) { return (tslib_1.__assign({}, state, { initPhase: DashboardInitPhase.Services })); },
})
    .addMapper({
    filter: dashboardInitSlow,
    mapper: function (state) { return (tslib_1.__assign({}, state, { isInitSlow: true })); },
})
    .addMapper({
    filter: dashboardInitFailed,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, { initPhase: DashboardInitPhase.Failed, isInitSlow: false, initError: action.payload, model: new DashboardModel({ title: 'Dashboard init failed' }, { canSave: false, canEdit: false }) })); },
})
    .addMapper({
    filter: dashboardInitCompleted,
    mapper: function (state, action) { return (tslib_1.__assign({}, state, { initPhase: DashboardInitPhase.Completed, model: action.payload, isInitSlow: false })); },
})
    .addMapper({
    filter: cleanUpDashboard,
    mapper: function (state, action) {
        // Destroy current DashboardModel
        // Very important as this removes all dashboard event listeners
        state.model.destroy();
        return tslib_1.__assign({}, state, { initPhase: DashboardInitPhase.NotStarted, model: null, isInitSlow: false, initError: null });
    },
})
    .create();
export default {
    dashboard: dashboardReducer,
};
//# sourceMappingURL=reducers.js.map