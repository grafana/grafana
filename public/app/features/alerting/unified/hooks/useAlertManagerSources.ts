import { useMemo } from 'react';

import { dataSources } from '../utils/datasource';

export function useAlertManagerSources(accessType: 'instance' | 'notification') {
  return useMemo(() => dataSources.alertManagers.byPermission(accessType), [accessType]);
}
