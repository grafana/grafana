import { __awaiter } from "tslib";
import { reportInteraction } from '@grafana/runtime';
import { getMetadataHelp, getMetadataType } from 'app/plugins/datasource/prometheus/language_provider';
import { regexifyLabelValuesQueryString } from '../../../shared/parsingUtils';
import { stateSlice } from './state';
const { setFilteredMetricCount } = stateSlice.actions;
export function setMetrics(datasource, query, initialMetrics) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        // metadata is set in the metric select now
        // use this to disable metadata search and display
        let hasMetadata = true;
        const metadata = datasource.languageProvider.metricsMetadata;
        if (metadata && Object.keys(metadata).length === 0) {
            hasMetadata = false;
        }
        let nameHaystackDictionaryData = {};
        let metaHaystackDictionaryData = {};
        // pass in metrics from getMetrics in the query builder, reduced in the metric select
        let metricsData;
        metricsData = initialMetrics === null || initialMetrics === void 0 ? void 0 : initialMetrics.map((m) => {
            const metricData = buildMetricData(m, datasource);
            const metaDataString = `${m}¦${metricData.description}`;
            nameHaystackDictionaryData[m] = metricData;
            metaHaystackDictionaryData[metaDataString] = metricData;
            return metricData;
        });
        return {
            isLoading: false,
            hasMetadata: hasMetadata,
            metrics: metricsData !== null && metricsData !== void 0 ? metricsData : [],
            metaHaystackDictionary: metaHaystackDictionaryData,
            nameHaystackDictionary: nameHaystackDictionaryData,
            totalMetricCount: (_a = metricsData === null || metricsData === void 0 ? void 0 : metricsData.length) !== null && _a !== void 0 ? _a : 0,
            filteredMetricCount: (_b = metricsData === null || metricsData === void 0 ? void 0 : metricsData.length) !== null && _b !== void 0 ? _b : 0,
        };
    });
}
/**
 * Builds the metric data object with type and description
 *
 * @param   metric  The metric name
 * @param   datasource  The Prometheus datasource for mapping metradata to the metric name
 * @returns A MetricData object.
 */
function buildMetricData(metric, datasource) {
    let type = getMetadataType(metric, datasource.languageProvider.metricsMetadata);
    const description = getMetadataHelp(metric, datasource.languageProvider.metricsMetadata);
    ['histogram', 'summary'].forEach((t) => {
        if ((description === null || description === void 0 ? void 0 : description.toLowerCase().includes(t)) && type !== t) {
            type += ` (${t})`;
        }
    });
    const metricData = {
        value: metric,
        type: type,
        description: description,
    };
    return metricData;
}
/**
 * The filtered and paginated metrics displayed in the modal
 * */
export function displayedMetrics(state, dispatch) {
    const filteredSorted = filterMetrics(state);
    if (!state.isLoading && state.filteredMetricCount !== filteredSorted.length) {
        dispatch(setFilteredMetricCount(filteredSorted.length));
    }
    return sliceMetrics(filteredSorted, state.pageNum, state.resultsPerPage);
}
/**
 * Filter the metrics with all the options, fuzzy, type, null metadata
 */
export function filterMetrics(state) {
    let filteredMetrics = state.metrics;
    if (state.fuzzySearchQuery && !state.useBackend) {
        if (state.fullMetaSearch) {
            filteredMetrics = state.metaHaystackOrder.map((needle) => state.metaHaystackDictionary[needle]);
        }
        else {
            filteredMetrics = state.nameHaystackOrder.map((needle) => state.nameHaystackDictionary[needle]);
        }
    }
    if (state.selectedTypes.length > 0) {
        filteredMetrics = filteredMetrics.filter((m, idx) => {
            // Matches type
            const matchesSelectedType = state.selectedTypes.some((t) => {
                if (m.type && t.value) {
                    return m.type.includes(t.value);
                }
                if (!m.type && t.value === 'no type') {
                    return true;
                }
                return false;
            });
            // when a user filters for type, only return metrics with defined types
            return matchesSelectedType;
        });
    }
    if (!state.includeNullMetadata) {
        filteredMetrics = filteredMetrics.filter((m) => {
            return m.type !== undefined && m.description !== undefined;
        });
    }
    return filteredMetrics;
}
export function calculatePageList(state) {
    if (!state.metrics.length) {
        return [];
    }
    const calcResultsPerPage = state.resultsPerPage === 0 ? 1 : state.resultsPerPage;
    const pages = Math.floor(filterMetrics(state).length / calcResultsPerPage) + 1;
    return [...Array(pages).keys()].map((i) => i + 1);
}
export function sliceMetrics(metrics, pageNum, resultsPerPage) {
    const calcResultsPerPage = resultsPerPage === 0 ? 1 : resultsPerPage;
    const start = pageNum === 1 ? 0 : (pageNum - 1) * calcResultsPerPage;
    const end = start + calcResultsPerPage;
    return metrics.slice(start, end);
}
export const calculateResultsPerPage = (results, defaultResults, max) => {
    if (results < 1) {
        return 1;
    }
    if (results > max) {
        return max;
    }
    return results !== null && results !== void 0 ? results : defaultResults;
};
/**
 * The backend query that replaces the uFuzzy search when the option 'useBackend' has been selected
 * this is a regex search either to the series or labels Prometheus endpoint
 * depending on which the Prometheus type or version supports
 * @param metricText
 * @param labels
 * @param datasource
 */
export function getBackendSearchMetrics(metricText, labels, datasource) {
    return __awaiter(this, void 0, void 0, function* () {
        const queryString = regexifyLabelValuesQueryString(metricText);
        const labelsParams = labels.map((label) => {
            return `,${label.label}="${label.value}"`;
        });
        const params = `label_values({__name__=~".*${queryString}"${labels ? labelsParams.join() : ''}},__name__)`;
        const results = datasource.metricFindQuery(params);
        return yield results.then((results) => {
            return results.map((result) => buildMetricData(result.text, datasource));
        });
    });
}
export function tracking(event, state, metric, query) {
    switch (event) {
        case 'grafana_prom_metric_encycopedia_tracking':
            reportInteraction(event, {
                metric: metric,
                hasMetadata: state === null || state === void 0 ? void 0 : state.hasMetadata,
                totalMetricCount: state === null || state === void 0 ? void 0 : state.totalMetricCount,
                fuzzySearchQuery: state === null || state === void 0 ? void 0 : state.fuzzySearchQuery,
                fullMetaSearch: state === null || state === void 0 ? void 0 : state.fullMetaSearch,
                selectedTypes: state === null || state === void 0 ? void 0 : state.selectedTypes,
                useRegexSearch: state === null || state === void 0 ? void 0 : state.useBackend,
                includeResultsWithoutMetadata: state === null || state === void 0 ? void 0 : state.includeNullMetadata,
            });
        case 'grafana_prom_metric_encycopedia_disable_text_wrap_interaction':
            reportInteraction(event, {
                disableTextWrap: state === null || state === void 0 ? void 0 : state.disableTextWrap,
            });
        case 'grafana_prometheus_metric_encyclopedia_open':
            reportInteraction(event, {
                query: query,
            });
    }
}
export const promTypes = [
    {
        value: 'counter',
        description: 'A cumulative metric that represents a single monotonically increasing counter whose value can only increase or be reset to zero on restart.',
    },
    {
        value: 'gauge',
        description: 'A metric that represents a single numerical value that can arbitrarily go up and down.',
    },
    {
        value: 'histogram',
        description: 'A histogram samples observations (usually things like request durations or response sizes) and counts them in configurable buckets.',
    },
    {
        value: 'summary',
        description: 'A summary samples observations (usually things like request durations and response sizes) and can calculate configurable quantiles over a sliding time window.',
    },
    {
        value: 'unknown',
        description: 'These metrics have been given the type unknown in the metadata.',
    },
    {
        value: 'no type',
        description: 'These metrics have no defined type in the metadata.',
    },
];
export const placeholders = {
    browse: 'Search metrics by name',
    metadataSearchSwitch: 'Include description in search',
    type: 'Filter by type',
    includeNullMetadata: 'Include results with no metadata',
    setUseBackend: 'Enable regex search',
};
//# sourceMappingURL=helpers.js.map