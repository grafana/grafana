import { useMemo } from 'react';
import { getDataSourceSrv } from '@grafana/runtime';
import { isExpressionReference } from '@grafana/runtime/src/utils/DataSourceWithBackend';
export function useAlertQueriesStatus(queries) {
    const allDataSourcesAvailable = useMemo(() => queries
        .filter((query) => !isExpressionReference(query.datasourceUid))
        .every((query) => {
        const instanceSettings = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
        return Boolean(instanceSettings);
    }), [queries]);
    return { allDataSourcesAvailable };
}
//# sourceMappingURL=useAlertQueriesStatus.js.map