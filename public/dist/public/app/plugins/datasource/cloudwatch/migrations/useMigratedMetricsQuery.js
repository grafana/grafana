import { useEffect, useMemo } from 'react';
import { migrateMetricQuery } from './metricQueryMigrations';
/**
 * Returns queries with migrations, and calls onChange function to notify if it changes
 */
const useMigratedMetricsQuery = (query, onChangeQuery) => {
    const migratedQUery = useMemo(() => migrateMetricQuery(query), [query]);
    useEffect(() => {
        if (migratedQUery !== query) {
            onChangeQuery(migratedQUery);
        }
    }, [migratedQUery, query, onChangeQuery]);
    return migratedQUery;
};
export default useMigratedMetricsQuery;
//# sourceMappingURL=useMigratedMetricsQuery.js.map