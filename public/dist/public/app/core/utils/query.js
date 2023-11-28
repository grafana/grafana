export const getNextRefIdChar = (queries) => {
    for (let num = 0;; num++) {
        const refId = getRefId(num);
        if (!queries.some((query) => query.refId === refId)) {
            return refId;
        }
    }
};
// This function checks if the query has defined properties beyond those defined in the DataQuery interface.
export function queryIsEmpty(query) {
    const dataQueryProps = ['refId', 'hide', 'key', 'queryType', 'datasource'];
    for (const key in query) {
        // label is not a DataQuery prop, but it's defined in the query when called from the QueryRunner.
        if (key === 'label') {
            continue;
        }
        if (!dataQueryProps.includes(key)) {
            return false;
        }
    }
    return true;
}
export function addQuery(queries, query, datasource) {
    const q = Object.assign(Object.assign({}, query), { refId: getNextRefIdChar(queries), hide: false });
    if (!q.datasource && datasource) {
        q.datasource = datasource;
    }
    return [...queries, q];
}
export function isDataQuery(url) {
    if (url.indexOf('api/datasources/proxy') !== -1 || url.indexOf('api/ds/query') !== -1) {
        return true;
    }
    return false;
}
export function isLocalUrl(url) {
    return !url.match(/^http/);
}
function getRefId(num) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (num < letters.length) {
        return letters[num];
    }
    else {
        return getRefId(Math.floor(num / letters.length) - 1) + letters[num % letters.length];
    }
}
/**
 * Returns the input value for non empty string and undefined otherwise
 *
 * It is inadvisable to set a query param to an empty string as it will be added to the URL.
 * It is better to keep it undefined so the param won't be added to the URL at all.
 */
export function getQueryParamValue(value) {
    return value || undefined;
}
//# sourceMappingURL=query.js.map