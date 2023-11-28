import { startCase, uniq } from 'lodash';
import { TraceqlSearchScope } from '../dataquery.gen';
import { intrinsics } from '../traceql/traceql';
export const generateQueryFromFilters = (filters) => {
    return `{${filters
        .filter((f) => { var _a; return f.tag && f.operator && ((_a = f.value) === null || _a === void 0 ? void 0 : _a.length); })
        .map((f) => `${scopeHelper(f)}${f.tag}${f.operator}${valueHelper(f)}`)
        .join(' && ')}}`;
};
const valueHelper = (f) => {
    if (Array.isArray(f.value) && f.value.length > 1) {
        return `"${f.value.join('|')}"`;
    }
    if (f.valueType === 'string') {
        return `"${f.value}"`;
    }
    return f.value;
};
const scopeHelper = (f) => {
    var _a;
    // Intrinsic fields don't have a scope
    if (intrinsics.find((t) => t === f.tag)) {
        return '';
    }
    return ((f.scope === TraceqlSearchScope.Resource || f.scope === TraceqlSearchScope.Span ? (_a = f.scope) === null || _a === void 0 ? void 0 : _a.toLowerCase() : '') + '.');
};
export const filterScopedTag = (f) => {
    return scopeHelper(f) + f.tag;
};
export const filterTitle = (f) => {
    // Special case for the intrinsic "name" since a label called "Name" isn't explicit
    if (f.tag === 'name') {
        return 'Span Name';
    }
    return startCase(filterScopedTag(f));
};
export const getFilteredTags = (tags, staticTags) => {
    return [...intrinsics, ...tags].filter((t) => !staticTags.includes(t));
};
export const getUnscopedTags = (scopes) => {
    return uniq(scopes.map((scope) => (scope.name && scope.name !== 'intrinsic' && scope.tags ? scope.tags : [])).flat());
};
export const getAllTags = (scopes) => {
    return uniq(scopes.map((scope) => (scope.tags ? scope.tags : [])).flat());
};
export const getTagsByScope = (scopes, scope) => {
    return uniq(scopes.map((s) => (s.name && s.name === scope && s.tags ? s.tags : [])).flat());
};
export function replaceAt(array, index, value) {
    const ret = array.slice(0);
    ret[index] = value;
    return ret;
}
export const operatorSelectableValue = (op) => {
    const result = { label: op, value: op };
    switch (op) {
        case '=':
            result.description = 'Equals';
            break;
        case '!=':
            result.description = 'Not equals';
            break;
        case '>':
            result.description = 'Greater';
            break;
        case '>=':
            result.description = 'Greater or Equal';
            break;
        case '<':
            result.description = 'Less';
            break;
        case '<=':
            result.description = 'Less or Equal';
            break;
        case '=~':
            result.description = 'Matches regex';
            break;
        case '!~':
            result.description = 'Does not match regex';
            break;
    }
    return result;
};
//# sourceMappingURL=utils.js.map