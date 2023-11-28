import { DashboardModel } from '../../app/features/dashboard/state';
export const getDashboardModel = (json, meta = {}) => {
    const getVariablesFromState = () => json.templating.list;
    return new DashboardModel(json, meta, { getVariablesFromState });
};
//# sourceMappingURL=getDashboardModel.js.map