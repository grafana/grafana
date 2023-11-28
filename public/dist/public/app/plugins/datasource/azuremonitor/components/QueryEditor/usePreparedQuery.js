import deepEqual from 'fast-deep-equal';
import { defaults } from 'lodash';
import { useEffect, useMemo } from 'react';
import { AzureQueryType } from '../../types';
import migrateQuery from '../../utils/migrateQuery';
const DEFAULT_QUERY = {
    queryType: AzureQueryType.AzureMonitor,
};
const prepareQuery = (query) => {
    // Note: _.defaults does not apply default values deeply.
    const withDefaults = defaults({}, query, DEFAULT_QUERY);
    const migratedQuery = migrateQuery(withDefaults);
    // If we didn't make any changes to the object, then return the original object to keep the
    // identity the same, and not trigger any other useEffects or anything.
    return deepEqual(migratedQuery, query) ? query : migratedQuery;
};
/**
 * Returns queries with some defaults + migrations, and calls onChange function to notify if it changes
 */
const usePreparedQuery = (query, onChangeQuery) => {
    const preparedQuery = useMemo(() => prepareQuery(query), [query]);
    useEffect(() => {
        if (preparedQuery !== query) {
            onChangeQuery(preparedQuery);
        }
    }, [preparedQuery, query, onChangeQuery]);
    return preparedQuery;
};
export default usePreparedQuery;
//# sourceMappingURL=usePreparedQuery.js.map