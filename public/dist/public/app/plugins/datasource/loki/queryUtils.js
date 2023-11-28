import { __rest } from "tslib";
import { escapeRegExp } from 'lodash';
import { parser, LineFilter, PipeExact, PipeMatch, Filter, String, LabelFormatExpr, Selector, PipelineExpr, LabelParser, JsonExpressionParser, LabelFilter, MetricExpr, Matcher, Identifier, Range, formatLokiQuery, Logfmt, Json, } from '@grafana/lezer-logql';
import { reportInteraction } from '@grafana/runtime';
import { ErrorId, replaceVariables, returnVariables } from '../prometheus/querybuilder/shared/parsingUtils';
import { placeHolderScopedVars } from './components/monaco-query-field/monaco-completion-provider/validation';
import { getStreamSelectorPositions, NodePosition } from './modifyQuery';
import { LokiQueryType } from './types';
export function formatQuery(selector) {
    return `${selector || ''}`.trim();
}
/**
 * Returns search terms from a LogQL query.
 * E.g., `{} |= foo |=bar != baz` returns `['foo', 'bar']`.
 */
export function getHighlighterExpressionsFromQuery(input) {
    var _a, _b;
    const results = [];
    const filters = getNodesFromQuery(input, [LineFilter]);
    for (let filter of filters) {
        const pipeExact = (_a = filter.getChild(Filter)) === null || _a === void 0 ? void 0 : _a.getChild(PipeExact);
        const pipeMatch = (_b = filter.getChild(Filter)) === null || _b === void 0 ? void 0 : _b.getChild(PipeMatch);
        const string = filter.getChild(String);
        if ((!pipeExact && !pipeMatch) || !string) {
            continue;
        }
        const filterTerm = input.substring(string.from, string.to).trim();
        const backtickedTerm = filterTerm[0] === '`';
        const unwrappedFilterTerm = filterTerm.substring(1, filterTerm.length - 1);
        if (!unwrappedFilterTerm) {
            continue;
        }
        let resultTerm = '';
        // Only filter expressions with |~ operator are treated as regular expressions
        if (pipeMatch) {
            // When using backticks, Loki doesn't require to escape special characters and we can just push regular expression to highlights array
            // When using quotes, we have extra backslash escaping and we need to replace \\ with \
            resultTerm = backtickedTerm ? unwrappedFilterTerm : unwrappedFilterTerm.replace(/\\\\/g, '\\');
        }
        else {
            // We need to escape this string so it is not matched as regular expression
            resultTerm = escapeRegExp(unwrappedFilterTerm);
        }
        if (resultTerm) {
            results.push(resultTerm);
        }
    }
    return results;
}
export function getNormalizedLokiQuery(query) {
    const queryType = getLokiQueryType(query);
    // instant and range are deprecated, we want to remove them
    const { instant, range } = query, rest = __rest(query, ["instant", "range"]);
    return Object.assign(Object.assign({}, rest), { queryType });
}
export function getLokiQueryType(query) {
    // we are migrating from `.instant` and `.range` to `.queryType`
    // this function returns the correct query type
    const { queryType } = query;
    const hasValidQueryType = queryType === LokiQueryType.Range || queryType === LokiQueryType.Instant || queryType === LokiQueryType.Stream;
    // if queryType exists, it is respected
    if (hasValidQueryType) {
        return queryType;
    }
    // if no queryType, and instant===true, it's instant
    if (query.instant === true) {
        return LokiQueryType.Instant;
    }
    // otherwise it is range
    return LokiQueryType.Range;
}
const tagsToObscure = ['String', 'Identifier', 'LineComment', 'Number'];
const partsToKeep = ['__error__', '__interval', '__interval_ms', '__auto'];
export function obfuscate(query) {
    let obfuscatedQuery = query;
    const tree = parser.parse(query);
    tree.iterate({
        enter: ({ name, from, to }) => {
            const queryPart = query.substring(from, to);
            if (tagsToObscure.includes(name) && !partsToKeep.includes(queryPart)) {
                obfuscatedQuery = obfuscatedQuery.replace(queryPart, name);
            }
        },
    });
    return obfuscatedQuery;
}
export function parseToNodeNamesArray(query) {
    const queryParts = [];
    const tree = parser.parse(query);
    tree.iterate({
        enter: ({ name }) => {
            queryParts.push(name);
        },
    });
    return queryParts;
}
export function isQueryWithNode(query, nodeType) {
    let isQueryWithNode = false;
    const tree = parser.parse(query);
    tree.iterate({
        enter: ({ type }) => {
            if (type.id === nodeType) {
                isQueryWithNode = true;
                return false;
            }
        },
    });
    return isQueryWithNode;
}
export function getNodesFromQuery(query, nodeTypes) {
    const nodes = [];
    const tree = parser.parse(query);
    tree.iterate({
        enter: (node) => {
            if (nodeTypes === undefined || nodeTypes.includes(node.type.id)) {
                nodes.push(node.node);
            }
        },
    });
    return nodes;
}
export function getNodePositionsFromQuery(query, nodeTypes) {
    const positions = [];
    const tree = parser.parse(query);
    tree.iterate({
        enter: (node) => {
            if (nodeTypes === undefined || nodeTypes.includes(node.type.id)) {
                positions.push(NodePosition.fromNode(node.node));
            }
        },
    });
    return positions;
}
export function getNodeFromQuery(query, nodeType) {
    const nodes = getNodesFromQuery(query, [nodeType]);
    return nodes.length > 0 ? nodes[0] : undefined;
}
/**
 * Parses the query and looks for error nodes. If there is at least one, it returns false.
 * Grafana variables are considered errors, so if you need to validate a query
 * with variables you should interpolate it first.
 */
export function isQueryWithError(query) {
    return isQueryWithNode(query, ErrorId);
}
export function isLogsQuery(query) {
    return !isQueryWithNode(query, MetricExpr);
}
export function isQueryWithParser(query) {
    const nodes = getNodesFromQuery(query, [LabelParser, JsonExpressionParser, Logfmt]);
    const parserCount = nodes.length;
    return { queryWithParser: parserCount > 0, parserCount };
}
export function getParserFromQuery(query) {
    const parsers = getNodesFromQuery(query, [LabelParser, Json, Logfmt]);
    return parsers.length > 0 ? query.substring(parsers[0].from, parsers[0].to).trim() : undefined;
}
export function isQueryPipelineErrorFiltering(query) {
    var _a;
    const labels = getNodesFromQuery(query, [LabelFilter]);
    for (const node of labels) {
        const label = (_a = node.getChild(Matcher)) === null || _a === void 0 ? void 0 : _a.getChild(Identifier);
        if (label) {
            const labelName = query.substring(label.from, label.to);
            if (labelName === '__error__') {
                return true;
            }
        }
    }
    return false;
}
export function isQueryWithLabelFormat(query) {
    return isQueryWithNode(query, LabelFormatExpr);
}
export function getLogQueryFromMetricsQuery(query) {
    if (isLogsQuery(query)) {
        return query;
    }
    // Log query in metrics query composes of Selector & PipelineExpr
    const selectorNode = getNodeFromQuery(query, Selector);
    if (!selectorNode) {
        return '';
    }
    const selector = query.substring(selectorNode.from, selectorNode.to);
    const pipelineExprNode = getNodeFromQuery(query, PipelineExpr);
    const pipelineExpr = pipelineExprNode ? query.substring(pipelineExprNode.from, pipelineExprNode.to) : '';
    return `${selector} ${pipelineExpr}`.trim();
}
export function getLogQueryFromMetricsQueryAtPosition(query, position) {
    if (isLogsQuery(query)) {
        return query;
    }
    const metricQuery = getNodesFromQuery(query, [MetricExpr])
        .reverse() // So we don't get the root metric node
        .find((node) => node.from <= position && node.to >= position);
    if (!metricQuery) {
        return '';
    }
    return getLogQueryFromMetricsQuery(query.substring(metricQuery.from, metricQuery.to));
}
export function isQueryWithLabelFilter(query) {
    return isQueryWithNode(query, LabelFilter);
}
export function isQueryWithLineFilter(query) {
    return isQueryWithNode(query, LineFilter);
}
export function isQueryWithRangeVariable(query) {
    const rangeNodes = getNodesFromQuery(query, [Range]);
    for (const node of rangeNodes) {
        if (query.substring(node.from, node.to).match(/\[\$__range(_s|_ms)?/)) {
            return true;
        }
    }
    return false;
}
export function getStreamSelectorsFromQuery(query) {
    const labelMatcherPositions = getStreamSelectorPositions(query);
    const labelMatchers = labelMatcherPositions.map((labelMatcher) => {
        return query.slice(labelMatcher.from, labelMatcher.to);
    });
    return labelMatchers;
}
export function requestSupportsSplitting(allQueries) {
    const queries = allQueries
        .filter((query) => !query.hide)
        .filter((query) => !query.refId.includes('do-not-chunk'))
        .filter((query) => query.expr);
    return queries.length > 0;
}
export const isLokiQuery = (query) => {
    if (!query) {
        return false;
    }
    const lokiQuery = query;
    return lokiQuery.expr !== undefined;
};
export const getLokiQueryFromDataQuery = (query) => {
    if (!query || !isLokiQuery(query)) {
        return undefined;
    }
    return query;
};
export function formatLogqlQuery(query, datasource) {
    var _a, _b, _c, _d;
    const isInvalid = isQueryWithError(datasource.interpolateString(query, placeHolderScopedVars));
    reportInteraction('grafana_loki_format_query_clicked', {
        is_invalid: isInvalid,
        query_type: isLogsQuery(query) ? 'logs' : 'metric',
    });
    if (isInvalid) {
        return query;
    }
    let transformedQuery = replaceVariables(query);
    const transformationMatches = [];
    const tree = parser.parse(transformedQuery);
    // Variables are considered errors inside of the parser, so we need to remove them before formatting
    // We replace all variables with [0s] and keep track of the replaced variables
    // After formatting we replace [0s] with the original variable
    if (((_b = (_a = tree.topNode.firstChild) === null || _a === void 0 ? void 0 : _a.firstChild) === null || _b === void 0 ? void 0 : _b.type.id) === MetricExpr) {
        const pattern = /\[__V_[0-2]__\w+__V__\]/g;
        transformationMatches.push(...transformedQuery.matchAll(pattern));
        transformedQuery = transformedQuery.replace(pattern, '[0s]');
    }
    let formatted = formatLokiQuery(transformedQuery);
    if (((_d = (_c = tree.topNode.firstChild) === null || _c === void 0 ? void 0 : _c.firstChild) === null || _d === void 0 ? void 0 : _d.type.id) === MetricExpr) {
        transformationMatches.forEach((match) => {
            formatted = formatted.replace('[0s]', match[0]);
        });
    }
    return returnVariables(formatted);
}
//# sourceMappingURL=queryUtils.js.map