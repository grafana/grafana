import { useAsync } from 'react-use';

import { DashboardScene } from '../../scene/DashboardScene';

import { getPanelDatasourceTypes, getUnsupportedDashboardDatasources } from './utils';

export function useUnsupportedDatasources(dashboard: DashboardScene) {
  const { value: unsupportedDataSources } = useAsync(async () => {
    const types = getPanelDatasourceTypes(dashboard);
    return getUnsupportedDashboardDatasources(types);
  }, []);

  return unsupportedDataSources;
}
