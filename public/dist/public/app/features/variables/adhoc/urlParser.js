import { isArray, isString } from 'lodash';
export const toUrl = (filters) => {
    return filters.map((filter) => toArray(filter).map(escapeDelimiter).join('|'));
};
export const toFilters = (value) => {
    if (isArray(value)) {
        const values = value;
        return values.map(toFilter).filter(isFilter);
    }
    const filter = toFilter(value);
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
    const parts = value.split('|').map(unescapeDelimiter);
    return {
        key: parts[0],
        operator: parts[1],
        value: parts[2],
    };
}
function isFilter(filter) {
    return filter !== null && isString(filter.value);
}
//# sourceMappingURL=urlParser.js.map