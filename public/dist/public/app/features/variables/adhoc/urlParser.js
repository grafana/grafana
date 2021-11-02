import { isArray, isString } from 'lodash';
export var toUrl = function (filters) {
    return filters.map(function (filter) { return toArray(filter).map(escapeDelimiter).join('|'); });
};
export var toFilters = function (value) {
    if (isArray(value)) {
        var values = value;
        return values.map(toFilter).filter(isFilter);
    }
    var filter = toFilter(value);
    return filter === null ? [] : [filter];
};
function escapeDelimiter(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return /\|/g[Symbol.replace](value, '__gfp__');
}
function unescapeDelimiter(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return /__gfp__/g[Symbol.replace](value, '|');
}
function toArray(filter) {
    return [filter.key, filter.operator, filter.value];
}
function toFilter(value) {
    if (!isString(value) || value.length === 0) {
        return null;
    }
    var parts = value.split('|').map(unescapeDelimiter);
    return {
        key: parts[0],
        operator: parts[1],
        value: parts[2],
        condition: '',
    };
}
function isFilter(filter) {
    return filter !== null && isString(filter.value);
}
//# sourceMappingURL=urlParser.js.map