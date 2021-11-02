import { escapeRegExp } from 'lodash';
import { PIPE_PARSERS } from './syntax';
export function formatQuery(selector) {
    return ("" + (selector || '')).trim();
}
/**
 * Returns search terms from a LogQL query.
 * E.g., `{} |= foo |=bar != baz` returns `['foo', 'bar']`.
 */
export function getHighlighterExpressionsFromQuery(input) {
    var expression = input;
    var results = [];
    // Consume filter expression from left to right
    while (expression) {
        var filterStart = expression.search(/\|=|\|~|!=|!~/);
        // Nothing more to search
        if (filterStart === -1) {
            break;
        }
        // Drop terms for negative filters
        var filterOperator = expression.substr(filterStart, 2);
        var skip = expression.substr(filterStart).search(/!=|!~/) === 0;
        expression = expression.substr(filterStart + 2);
        if (skip) {
            continue;
        }
        // Check if there is more chained
        var filterEnd = expression.search(/\|=|\|~|!=|!~/);
        var filterTerm = void 0;
        if (filterEnd === -1) {
            filterTerm = expression.trim();
        }
        else {
            filterTerm = expression.substr(0, filterEnd).trim();
            expression = expression.substr(filterEnd);
        }
        var quotedTerm = filterTerm.match(/"(.*?)"/);
        var backtickedTerm = filterTerm.match(/`(.*?)`/);
        var term = quotedTerm || backtickedTerm;
        if (term) {
            var unwrappedFilterTerm = term[1];
            var regexOperator = filterOperator === '|~';
            // Only filter expressions with |~ operator are treated as regular expressions
            if (regexOperator) {
                // When using backticks, Loki doesn't require to escape special characters and we can just push regular expression to highlights array
                // When using quotes, we have extra backslash escaping and we need to replace \\ with \
                results.push(backtickedTerm ? unwrappedFilterTerm : unwrappedFilterTerm.replace(/\\\\/g, '\\'));
            }
            else {
                // We need to escape this string so it is not matched as regular expression
                results.push(escapeRegExp(unwrappedFilterTerm));
            }
        }
        else {
            return results;
        }
    }
    return results;
}
export function queryHasPipeParser(expr) {
    var parsers = PIPE_PARSERS.map(function (parser) { return "" + parser.label; }).join('|');
    var regexp = new RegExp("\\|\\s?(" + parsers + ")");
    return regexp.test(expr);
}
export function addParsedLabelToQuery(expr, key, value, operator) {
    return expr + (" | " + key + operator + "\"" + value.toString() + "\"");
}
//# sourceMappingURL=query_utils.js.map