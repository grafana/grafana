import { useMemo } from 'react';

import { getAlertManagerDataSourcesByPermission } from '../utils/datasource';

export function useAlertManagerSources(accessType: 'instance' | 'notification') {
  return useMemo(() => getAlertManagerDataSourcesByPermission(accessType), [accessType]);
}
