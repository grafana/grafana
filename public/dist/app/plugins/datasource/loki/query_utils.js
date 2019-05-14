var selectorRegexp = /(?:^|\s){[^{]*}/g;
export function parseQuery(input) {
    input = input || '';
    var match = input.match(selectorRegexp);
    var query = '';
    var regexp = input;
    if (match) {
        query = match[0].trim();
        regexp = input.replace(selectorRegexp, '').trim();
    }
    return { query: query, regexp: regexp };
}
export function formatQuery(selector, search) {
    return ((selector || '') + " " + (search || '')).trim();
}
//# sourceMappingURL=query_utils.js.map