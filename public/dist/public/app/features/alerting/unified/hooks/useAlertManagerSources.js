import { useMemo } from 'react';
import { getAlertManagerDataSourcesByPermission } from '../utils/datasource';
export function useAlertManagersByPermission(accessType) {
    return useMemo(() => getAlertManagerDataSourcesByPermission(accessType), [accessType]);
}
//# sourceMappingURL=useAlertManagerSources.js.map