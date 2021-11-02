import { __assign } from "tslib";
import { size } from 'lodash';
/**
 * Number of time series results needed before starting to suggest sum aggregation hints
 */
export var SUM_HINT_THRESHOLD_COUNT = 20;
export function getQueryHints(query, series, datasource) {
    var _a, _b, _c;
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
    // Check for need of rate()
    if (query.indexOf('rate(') === -1 && query.indexOf('increase(') === -1) {
        // Use metric metadata for exact types
        var nameMatch = query.match(/\b(\w+_(total|sum|count))\b/);
        var counterNameMetric = nameMatch ? nameMatch[1] : '';
        var metricsMetadata_1 = (_b = (_a = datasource === null || datasource === void 0 ? void 0 : datasource.languageProvider) === null || _a === void 0 ? void 0 : _a.metricsMetadata) !== null && _b !== void 0 ? _b : {};
        var metricMetadataKeys = Object.keys(metricsMetadata_1);
        var certain_1 = false;
        if (metricMetadataKeys.length > 0) {
            counterNameMetric =
                (_c = metricMetadataKeys.find(function (metricName) {
                    // Only considering first type information, could be non-deterministic
                    var metadata = metricsMetadata_1[metricName];
                    if (metadata.type.toLowerCase() === 'counter') {
                        var metricRegex = new RegExp("\\b" + metricName + "\\b");
                        if (query.match(metricRegex)) {
                            certain_1 = true;
                            return true;
                        }
                    }
                    return false;
                })) !== null && _c !== void 0 ? _c : '';
        }
        if (counterNameMetric) {
            var simpleMetric = query.trim().match(/^\w+$/);
            var verb = certain_1 ? 'is' : 'looks like';
            var label = "Metric " + counterNameMetric + " " + verb + " a counter.";
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
    // Check for recording rules expansion
    if (datasource && datasource.ruleMappings) {
        var mapping_1 = datasource.ruleMappings;
        var mappingForQuery = Object.keys(mapping_1).reduce(function (acc, ruleName) {
            var _a;
            if (query.search(ruleName) > -1) {
                return __assign(__assign({}, acc), (_a = {}, _a[ruleName] = mapping_1[ruleName], _a));
            }
            return acc;
        }, {});
        if (size(mappingForQuery) > 0) {
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
    return hints;
}
export function getInitHints(datasource) {
    var hints = [];
    // Hint if using Loki as Prometheus data source
    if (datasource.directUrl.includes('/loki') && !datasource.languageProvider.metrics.length) {
        hints.push({
            label: "Using Loki as a Prometheus data source is no longer supported. You must use the Loki data source for your Loki instance.",
            type: 'INFO',
        });
    }
    // Hint for big disabled lookups
    if (datasource.lookupsDisabled) {
        hints.push({
            label: "Labels and metrics lookup was disabled in data source settings.",
            type: 'INFO',
        });
    }
    return hints;
}
//# sourceMappingURL=query_hints.js.map