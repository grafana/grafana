import * as tslib_1 from "tslib";
import _ from 'lodash';
/**
 * Number of time series results needed before starting to suggest sum aggregation hints
 */
export var SUM_HINT_THRESHOLD_COUNT = 20;
export function getQueryHints(query, series, datasource) {
    var hints = [];
    // ..._bucket metric needs a histogram_quantile()
    var histogramMetric = query.trim().match(/^\w+_bucket$/);
    if (histogramMetric) {
        var label = 'Time series has buckets, you probably wanted a histogram.';
        hints.push({
            type: 'HISTOGRAM_QUANTILE',
            label: label,
            fix: {
                label: 'Fix by adding histogram_quantile().',
                action: {
                    type: 'ADD_HISTOGRAM_QUANTILE',
                    query: query,
                },
            },
        });
    }
    // Check for monotony on series (table results are being ignored here)
    if (series && series.length > 0) {
        series.forEach(function (s) {
            var datapoints = s.datapoints;
            if (query.indexOf('rate(') === -1 && datapoints.length > 1) {
                var increasing_1 = false;
                var nonNullData_1 = datapoints.filter(function (dp) { return dp[0] !== null; });
                var monotonic = nonNullData_1.every(function (dp, index) {
                    if (index === 0) {
                        return true;
                    }
                    increasing_1 = increasing_1 || dp[0] > nonNullData_1[index - 1][0];
                    // monotonic?
                    return dp[0] >= nonNullData_1[index - 1][0];
                });
                if (increasing_1 && monotonic) {
                    var simpleMetric = query.trim().match(/^\w+$/);
                    var label = 'Time series is monotonously increasing.';
                    var fix = void 0;
                    if (simpleMetric) {
                        fix = {
                            label: 'Fix by adding rate().',
                            action: {
                                type: 'ADD_RATE',
                                query: query,
                            },
                        };
                    }
                    else {
                        label = label + " Try applying a rate() function.";
                    }
                    hints.push({
                        type: 'APPLY_RATE',
                        label: label,
                        fix: fix,
                    });
                }
            }
        });
    }
    // Check for recording rules expansion
    if (datasource && datasource.ruleMappings) {
        var mapping_1 = datasource.ruleMappings;
        var mappingForQuery = Object.keys(mapping_1).reduce(function (acc, ruleName) {
            var _a;
            if (query.search(ruleName) > -1) {
                return tslib_1.__assign({}, acc, (_a = {}, _a[ruleName] = mapping_1[ruleName], _a));
            }
            return acc;
        }, {});
        if (_.size(mappingForQuery) > 0) {
            var label = 'Query contains recording rules.';
            hints.push({
                type: 'EXPAND_RULES',
                label: label,
                fix: {
                    label: 'Expand rules',
                    action: {
                        type: 'EXPAND_RULES',
                        query: query,
                        mapping: mappingForQuery,
                    },
                },
            });
        }
    }
    if (series && series.length >= SUM_HINT_THRESHOLD_COUNT) {
        var simpleMetric = query.trim().match(/^\w+$/);
        if (simpleMetric) {
            hints.push({
                type: 'ADD_SUM',
                label: 'Many time series results returned.',
                fix: {
                    label: 'Consider aggregating with sum().',
                    action: {
                        type: 'ADD_SUM',
                        query: query,
                        preventSubmit: true,
                    },
                },
            });
        }
    }
    return hints.length > 0 ? hints : null;
}
//# sourceMappingURL=query_hints.js.map