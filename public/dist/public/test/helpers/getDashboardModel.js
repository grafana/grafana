import { DashboardModel } from '../../app/features/dashboard/state';
export var getDashboardModel = function (json, meta) {
    if (meta === void 0) { meta = {}; }
    var getVariablesFromState = function () { return json.templating.list; };
    return new DashboardModel(json, meta, getVariablesFromState);
};
//# sourceMappingURL=getDashboardModel.js.map