import { scopesDashboardsScene } from './instance';

export const useScopesDashboardsState = () => {
  return scopesDashboardsScene?.useState();
};
