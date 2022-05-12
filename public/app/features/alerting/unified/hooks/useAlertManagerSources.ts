import { useMemo } from 'react';

import { getAlertManagerDataSourcesByPermission } from '../utils/datasource';

export function useAlertManagersByPermission(accessType: 'instance' | 'notification') {
  return useMemo(() => getAlertManagerDataSourcesByPermission(accessType), [accessType]);
}
