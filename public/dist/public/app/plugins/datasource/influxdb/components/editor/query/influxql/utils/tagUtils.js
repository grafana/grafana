function isRegex(text) {
    return /^\/.*\/$/.test(text);
}
// FIXME: sync these to the query-string-generation-code
// probably it's in influx_query_model.ts
export function getOperator(tag) {
    var _a;
    return (_a = tag.operator) !== null && _a !== void 0 ? _a : (isRegex(tag.value) ? '=~' : '=');
}
// FIXME: sync these to the query-string-generation-code
// probably it's in influx_query_model.ts
export function getCondition(tag, isFirst) {
    var _a;
    return isFirst ? undefined : (_a = tag.condition) !== null && _a !== void 0 ? _a : 'AND';
}
export function adjustOperatorIfNeeded(currentOperator, newTagValue) {
    const isCurrentOperatorRegex = currentOperator === '=~' || currentOperator === '!~';
    const isNewTagValueRegex = isRegex(newTagValue);
    if (isNewTagValueRegex) {
        return isCurrentOperatorRegex ? currentOperator : '=~';
    }
    else {
        return isCurrentOperatorRegex ? '=' : currentOperator;
    }
}
//# sourceMappingURL=tagUtils.js.map