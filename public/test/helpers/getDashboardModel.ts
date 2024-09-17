import { DashboardModel } from '../../app/features/dashboard/state';
import { DashboardMeta } from '../../app/types/dashboard';

export const getDashboardModel = (json: any, meta: DashboardMeta = {}) => {
  const getVariablesFromState = () => json.templating.list;
  return new DashboardModel(json, meta, { getVariablesFromState });
};
