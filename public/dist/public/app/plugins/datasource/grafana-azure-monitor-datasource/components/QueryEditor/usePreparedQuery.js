import { useEffect, useMemo } from 'react';
import { defaults } from 'lodash';
import { AzureQueryType } from '../../types';
import deepEqual from 'fast-deep-equal';
import migrateQuery from '../../utils/migrateQuery';
var DEFAULT_QUERY = {
    queryType: AzureQueryType.AzureMonitor,
};
var prepareQuery = function (query) {
    // Note: _.defaults does not apply default values deeply.
    var withDefaults = defaults({}, query, DEFAULT_QUERY);
    var migratedQuery = migrateQuery(withDefaults);
    // If we didn't make any changes to the object, then return the original object to keep the
    // identity the same, and not trigger any other useEffects or anything.
    return deepEqual(migratedQuery, query) ? query : migratedQuery;
};
/**
 * Returns queries with some defaults + migrations, and calls onChange function to notify if it changes
 */
var usePreparedQuery = function (query, onChangeQuery) {
    var preparedQuery = useMemo(function () { return prepareQuery(query); }, [query]);
    useEffect(function () {
        if (preparedQuery !== query) {
            onChangeQuery(preparedQuery);
        }
    }, [preparedQuery, query, onChangeQuery]);
    return preparedQuery;
};
export default usePreparedQuery;
//# sourceMappingURL=usePreparedQuery.js.map