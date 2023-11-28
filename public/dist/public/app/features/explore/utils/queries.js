import { getNextRefIdChar } from 'app/core/utils/query';
/**
 * Makes sure all the queries have unique (and valid) refIds
 */
export function withUniqueRefIds(queries) {
    const refIds = new Set(queries.map((query) => query.refId).filter(Boolean));
    if (refIds.size === queries.length) {
        return queries;
    }
    refIds.clear();
    return queries.map((query) => {
        if (query.refId && !refIds.has(query.refId)) {
            refIds.add(query.refId);
            return query;
        }
        const refId = getNextRefIdChar(queries);
        refIds.add(refId);
        const newQuery = Object.assign(Object.assign({}, query), { refId });
        return newQuery;
    });
}
//# sourceMappingURL=queries.js.map