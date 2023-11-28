import { __awaiter } from "tslib";
import { chain, difference, once } from 'lodash';
import Prism from 'prismjs';
import { AbstractLabelOperator, dateTime, LanguageProvider, } from '@grafana/data';
import { SearchFunctionType } from '@grafana/ui';
import { addLimitInfo, extractLabelMatchers, fixSummariesMetadata, parseSelector, processHistogramMetrics, processLabels, toPromLikeQuery, } from './language_utils';
import PromqlSyntax, { FUNCTIONS, RATE_RANGES } from './promql';
import { PrometheusCacheLevel } from './types';
const DEFAULT_KEYS = ['job', 'instance'];
const EMPTY_SELECTOR = '{}';
const HISTORY_ITEM_COUNT = 5;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
// Max number of items (metrics, labels, values) that we display as suggestions. Prevents from running out of memory.
export const SUGGESTIONS_LIMIT = 10000;
const wrapLabel = (label) => ({ label });
const setFunctionKind = (suggestion) => {
    suggestion.kind = 'function';
    return suggestion;
};
const buildCacheHeaders = (durationInSeconds) => {
    return {
        headers: {
            'X-Grafana-Cache': `private, max-age=${durationInSeconds}`,
        },
    };
};
export function addHistoryMetadata(item, history) {
    const cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
    const historyForItem = history.filter((h) => h.ts > cutoffTs && h.query === item.label);
    const count = historyForItem.length;
    const recent = historyForItem[0];
    let hint = `Queried ${count} times in the last 24h.`;
    if (recent) {
        const lastQueried = dateTime(recent.ts).fromNow();
        hint = `${hint} Last queried ${lastQueried}.`;
    }
    return Object.assign(Object.assign({}, item), { documentation: hint });
}
function addMetricsMetadata(metric, metadata) {
    const item = { label: metric };
    if (metadata && metadata[metric]) {
        item.documentation = getMetadataString(metric, metadata);
    }
    return item;
}
export function getMetadataString(metric, metadata) {
    if (!metadata[metric]) {
        return undefined;
    }
    const { type, help } = metadata[metric];
    return `${type.toUpperCase()}: ${help}`;
}
export function getMetadataHelp(metric, metadata) {
    if (!metadata[metric]) {
        return undefined;
    }
    return metadata[metric].help;
}
export function getMetadataType(metric, metadata) {
    if (!metadata[metric]) {
        return undefined;
    }
    return metadata[metric].type;
}
const PREFIX_DELIMITER_REGEX = /(="|!="|=~"|!~"|\{|\[|\(|\+|-|\/|\*|%|\^|\band\b|\bor\b|\bunless\b|==|>=|!=|<=|>|<|=|~|,)/;
const secondsInDay = 86400;
export default class PromQlLanguageProvider extends LanguageProvider {
    constructor(datasource, initialValues) {
        super();
        this.labelKeys = [];
        this.request = (url, defaultValue, params = {}, options) => __awaiter(this, void 0, void 0, function* () {
            try {
                const res = yield this.datasource.metadataRequest(url, params, options);
                return res.data.data;
            }
            catch (error) {
                console.error(error);
            }
            return defaultValue;
        });
        this.start = () => __awaiter(this, void 0, void 0, function* () {
            if (this.datasource.lookupsDisabled) {
                return [];
            }
            this.metrics = (yield this.fetchLabelValues('__name__')) || [];
            this.histogramMetrics = processHistogramMetrics(this.metrics).sort();
            return Promise.all([this.loadMetricsMetadata(), this.fetchLabels()]);
        });
        this.provideCompletionItems = ({ prefix, text, value, labelKey, wrapperClasses }, context = {}) => __awaiter(this, void 0, void 0, function* () {
            const emptyResult = { suggestions: [] };
            if (!value) {
                return emptyResult;
            }
            // Local text properties
            const empty = value.document.text.length === 0;
            const selectedLines = value.document.getTextsAtRange(value.selection);
            const currentLine = selectedLines.size === 1 ? selectedLines.first().getText() : null;
            const nextCharacter = currentLine ? currentLine[value.selection.anchor.offset] : null;
            // Syntax spans have 3 classes by default. More indicate a recognized token
            const tokenRecognized = wrapperClasses.length > 3;
            // Non-empty prefix, but not inside known token
            const prefixUnrecognized = prefix && !tokenRecognized;
            // Prevent suggestions in `function(|suffix)`
            const noSuffix = !nextCharacter || nextCharacter === ')';
            // Prefix is safe if it does not immediately follow a complete expression and has no text after it
            const safePrefix = prefix && !text.match(/^[\]})\s]+$/) && noSuffix;
            // About to type next operand if preceded by binary operator
            const operatorsPattern = /[+\-*/^%]/;
            const isNextOperand = text.match(operatorsPattern);
            // Determine candidates by CSS context
            if (wrapperClasses.includes('context-range')) {
                // Suggestions for metric[|]
                return this.getRangeCompletionItems();
            }
            else if (wrapperClasses.includes('context-labels')) {
                // Suggestions for metric{|} and metric{foo=|}, as well as metric-independent label queries like {|}
                return this.getLabelCompletionItems({ prefix, text, value, labelKey, wrapperClasses });
            }
            else if (wrapperClasses.includes('context-aggregation')) {
                // Suggestions for sum(metric) by (|)
                return this.getAggregationCompletionItems(value);
            }
            else if (empty) {
                // Suggestions for empty query field
                return this.getEmptyCompletionItems(context);
            }
            else if (prefixUnrecognized && noSuffix && !isNextOperand) {
                // Show term suggestions in a couple of scenarios
                return this.getBeginningCompletionItems(context);
            }
            else if (prefixUnrecognized && safePrefix) {
                // Show term suggestions in a couple of scenarios
                return this.getTermCompletionItems();
            }
            return emptyResult;
        });
        this.getBeginningCompletionItems = (context) => {
            return {
                suggestions: [...this.getEmptyCompletionItems(context).suggestions, ...this.getTermCompletionItems().suggestions],
            };
        };
        this.getEmptyCompletionItems = (context) => {
            const { history } = context;
            const suggestions = [];
            if (history && history.length) {
                const historyItems = chain(history)
                    .map((h) => h.query.expr)
                    .filter()
                    .uniq()
                    .take(HISTORY_ITEM_COUNT)
                    .map(wrapLabel)
                    .map((item) => addHistoryMetadata(item, history))
                    .value();
                suggestions.push({
                    searchFunctionType: SearchFunctionType.Prefix,
                    skipSort: true,
                    label: 'History',
                    items: historyItems,
                });
            }
            return { suggestions };
        };
        this.getTermCompletionItems = () => {
            const { metrics, metricsMetadata } = this;
            const suggestions = [];
            suggestions.push({
                searchFunctionType: SearchFunctionType.Prefix,
                label: 'Functions',
                items: FUNCTIONS.map(setFunctionKind),
            });
            if (metrics && metrics.length) {
                suggestions.push({
                    label: 'Metrics',
                    items: metrics.map((m) => addMetricsMetadata(m, metricsMetadata)),
                    searchFunctionType: SearchFunctionType.Fuzzy,
                });
            }
            return { suggestions };
        };
        this.getAggregationCompletionItems = (value) => __awaiter(this, void 0, void 0, function* () {
            const suggestions = [];
            // Stitch all query lines together to support multi-line queries
            let queryOffset;
            const queryText = value.document.getBlocks().reduce((text, block) => {
                if (text === undefined) {
                    return '';
                }
                if (!block) {
                    return text;
                }
                const blockText = block === null || block === void 0 ? void 0 : block.getText();
                if (value.anchorBlock.key === block.key) {
                    // Newline characters are not accounted for but this is irrelevant
                    // for the purpose of extracting the selector string
                    queryOffset = value.selection.anchor.offset + text.length;
                }
                return text + blockText;
            }, '');
            // Try search for selector part on the left-hand side, such as `sum (m) by (l)`
            const openParensAggregationIndex = queryText.lastIndexOf('(', queryOffset);
            let openParensSelectorIndex = queryText.lastIndexOf('(', openParensAggregationIndex - 1);
            let closeParensSelectorIndex = queryText.indexOf(')', openParensSelectorIndex);
            // Try search for selector part of an alternate aggregation clause, such as `sum by (l) (m)`
            if (openParensSelectorIndex === -1) {
                const closeParensAggregationIndex = queryText.indexOf(')', queryOffset);
                closeParensSelectorIndex = queryText.indexOf(')', closeParensAggregationIndex + 1);
                openParensSelectorIndex = queryText.lastIndexOf('(', closeParensSelectorIndex);
            }
            const result = {
                suggestions,
                context: 'context-aggregation',
            };
            // Suggestions are useless for alternative aggregation clauses without a selector in context
            if (openParensSelectorIndex === -1) {
                return result;
            }
            // Range vector syntax not accounted for by subsequent parse so discard it if present
            const selectorString = queryText
                .slice(openParensSelectorIndex + 1, closeParensSelectorIndex)
                .replace(/\[[^\]]+\]$/, '');
            const selector = parseSelector(selectorString, selectorString.length - 2).selector;
            const series = yield this.getSeries(selector);
            const labelKeys = Object.keys(series);
            if (labelKeys.length > 0) {
                const limitInfo = addLimitInfo(labelKeys);
                suggestions.push({
                    label: `Labels${limitInfo}`,
                    items: labelKeys.map(wrapLabel),
                    searchFunctionType: SearchFunctionType.Fuzzy,
                });
            }
            return result;
        });
        this.getLabelCompletionItems = ({ text, wrapperClasses, labelKey, value, }) => __awaiter(this, void 0, void 0, function* () {
            if (!value) {
                return { suggestions: [] };
            }
            const suggestions = [];
            const line = value.anchorBlock.getText();
            const cursorOffset = value.selection.anchor.offset;
            const suffix = line.substr(cursorOffset);
            const prefix = line.substr(0, cursorOffset);
            const isValueStart = text.match(/^(=|=~|!=|!~)/);
            const isValueEnd = suffix.match(/^"?[,}]|$/);
            // Detect cursor in front of value, e.g., {key=|"}
            const isPreValue = prefix.match(/(=|=~|!=|!~)$/) && suffix.match(/^"/);
            // Don't suggest anything at the beginning or inside a value
            const isValueEmpty = isValueStart && isValueEnd;
            const hasValuePrefix = isValueEnd && !isValueStart;
            if ((!isValueEmpty && !hasValuePrefix) || isPreValue) {
                return { suggestions };
            }
            // Get normalized selector
            let selector;
            let parsedSelector;
            try {
                parsedSelector = parseSelector(line, cursorOffset);
                selector = parsedSelector.selector;
            }
            catch (_a) {
                selector = EMPTY_SELECTOR;
            }
            const containsMetric = selector.includes('__name__=');
            const existingKeys = parsedSelector ? parsedSelector.labelKeys : [];
            let series = {};
            // Query labels for selector
            if (selector) {
                series = yield this.getSeries(selector, !containsMetric);
            }
            if (Object.keys(series).length === 0) {
                console.warn(`Server did not return any values for selector = ${selector}`);
                return { suggestions };
            }
            let context;
            if ((text && isValueStart) || wrapperClasses.includes('attr-value')) {
                // Label values
                if (labelKey && series[labelKey]) {
                    context = 'context-label-values';
                    const limitInfo = addLimitInfo(series[labelKey]);
                    suggestions.push({
                        label: `Label values for "${labelKey}"${limitInfo}`,
                        items: series[labelKey].map(wrapLabel),
                        searchFunctionType: SearchFunctionType.Fuzzy,
                    });
                }
            }
            else {
                // Label keys
                const labelKeys = series ? Object.keys(series) : containsMetric ? null : DEFAULT_KEYS;
                if (labelKeys) {
                    const possibleKeys = difference(labelKeys, existingKeys);
                    if (possibleKeys.length) {
                        context = 'context-labels';
                        const newItems = possibleKeys.map((key) => ({ label: key }));
                        const limitInfo = addLimitInfo(newItems);
                        const newSuggestion = {
                            label: `Labels${limitInfo}`,
                            items: newItems,
                            searchFunctionType: SearchFunctionType.Fuzzy,
                        };
                        suggestions.push(newSuggestion);
                    }
                }
            }
            return { context, suggestions };
        });
        /**
         * @param key
         */
        this.fetchLabelValues = (key) => __awaiter(this, void 0, void 0, function* () {
            const params = this.datasource.getAdjustedInterval();
            const interpolatedName = this.datasource.interpolateString(key);
            const url = `/api/v1/label/${interpolatedName}/values`;
            const value = yield this.request(url, [], params, this.getDefaultCacheHeaders());
            return value !== null && value !== void 0 ? value : [];
        });
        /**
         * Gets series values
         * Function to replace old getSeries calls in a way that will provide faster endpoints for new prometheus instances,
         * while maintaining backward compatability
         * @param labelName
         * @param selector
         */
        this.getSeriesValues = (labelName, selector) => __awaiter(this, void 0, void 0, function* () {
            var _b;
            if (!this.datasource.hasLabelsMatchAPISupport()) {
                const data = yield this.getSeries(selector);
                return (_b = data[labelName]) !== null && _b !== void 0 ? _b : [];
            }
            return yield this.fetchSeriesValuesWithMatch(labelName, selector);
        });
        /**
         * Fetches all values for a label, with optional match[]
         * @param name
         * @param match
         */
        this.fetchSeriesValuesWithMatch = (name, match) => __awaiter(this, void 0, void 0, function* () {
            const interpolatedName = name ? this.datasource.interpolateString(name) : null;
            const interpolatedMatch = match ? this.datasource.interpolateString(match) : null;
            const range = this.datasource.getAdjustedInterval();
            const urlParams = Object.assign(Object.assign({}, range), (interpolatedMatch && { 'match[]': interpolatedMatch }));
            const value = yield this.request(`/api/v1/label/${interpolatedName}/values`, [], urlParams, this.getDefaultCacheHeaders());
            return value !== null && value !== void 0 ? value : [];
        });
        /**
         * Gets series labels
         * Function to replace old getSeries calls in a way that will provide faster endpoints for new prometheus instances,
         * while maintaining backward compatability. The old API call got the labels and the values in a single query,
         * but with the new query we need two calls, one to get the labels, and another to get the values.
         *
         * @param selector
         * @param otherLabels
         */
        this.getSeriesLabels = (selector, otherLabels) => __awaiter(this, void 0, void 0, function* () {
            let possibleLabelNames, data;
            if (!this.datasource.hasLabelsMatchAPISupport()) {
                data = yield this.getSeries(selector);
                possibleLabelNames = Object.keys(data); // all names from prometheus
            }
            else {
                // Exclude __name__ from output
                otherLabels.push({ name: '__name__', value: '', op: '!=' });
                data = yield this.fetchSeriesLabelsMatch(selector);
                possibleLabelNames = Object.keys(data);
            }
            const usedLabelNames = new Set(otherLabels.map((l) => l.name)); // names used in the query
            return possibleLabelNames.filter((l) => !usedLabelNames.has(l));
        });
        /**
         * Fetch labels for a series using /series endpoint. This is cached by its args but also by the global timeRange currently selected as
         * they can change over requested time.
         * @param name
         * @param withName
         */
        this.fetchSeriesLabels = (name, withName) => __awaiter(this, void 0, void 0, function* () {
            const interpolatedName = this.datasource.interpolateString(name);
            const range = this.datasource.getAdjustedInterval();
            const urlParams = Object.assign(Object.assign({}, range), { 'match[]': interpolatedName });
            const url = `/api/v1/series`;
            const data = yield this.request(url, [], urlParams, this.getDefaultCacheHeaders());
            const { values } = processLabels(data, withName);
            return values;
        });
        /**
         * Fetch labels for a series using /labels endpoint.  This is cached by its args but also by the global timeRange currently selected as
         * they can change over requested time.
         * @param name
         * @param withName
         */
        this.fetchSeriesLabelsMatch = (name, withName) => __awaiter(this, void 0, void 0, function* () {
            const interpolatedName = this.datasource.interpolateString(name);
            const range = this.datasource.getAdjustedInterval();
            const urlParams = Object.assign(Object.assign({}, range), { 'match[]': interpolatedName });
            const url = `/api/v1/labels`;
            const data = yield this.request(url, [], urlParams, this.getDefaultCacheHeaders());
            // Convert string array to Record<string , []>
            return data.reduce((ac, a) => (Object.assign(Object.assign({}, ac), { [a]: '' })), {});
        });
        /**
         * Fetch series for a selector. Use this for raw results. Use fetchSeriesLabels() to get labels.
         * @param match
         */
        this.fetchSeries = (match) => __awaiter(this, void 0, void 0, function* () {
            const url = '/api/v1/series';
            const range = this.datasource.getTimeRangeParams();
            const params = Object.assign(Object.assign({}, range), { 'match[]': match });
            return yield this.request(url, {}, params, this.getDefaultCacheHeaders());
        });
        /**
         * Fetch this only one as we assume this won't change over time. This is cached differently from fetchSeriesLabels
         * because we can cache more aggressively here and also we do not want to invalidate this cache the same way as in
         * fetchSeriesLabels.
         */
        this.fetchDefaultSeries = once(() => __awaiter(this, void 0, void 0, function* () {
            const values = yield Promise.all(DEFAULT_KEYS.map((key) => this.fetchLabelValues(key)));
            return DEFAULT_KEYS.reduce((acc, key, i) => (Object.assign(Object.assign({}, acc), { [key]: values[i] })), {});
        }));
        this.datasource = datasource;
        this.histogramMetrics = [];
        this.timeRange = { start: 0, end: 0 };
        this.metrics = [];
        Object.assign(this, initialValues);
    }
    getDefaultCacheHeaders() {
        if (this.datasource.cacheLevel !== PrometheusCacheLevel.None) {
            return buildCacheHeaders(this.datasource.getCacheDurationInMinutes() * 60);
        }
        return;
    }
    // Strip syntax chars so that typeahead suggestions can work on clean inputs
    cleanText(s) {
        const parts = s.split(PREFIX_DELIMITER_REGEX);
        const last = parts.pop();
        return last.trimLeft().replace(/"$/, '').replace(/^"/, '');
    }
    get syntax() {
        return PromqlSyntax;
    }
    loadMetricsMetadata() {
        return __awaiter(this, void 0, void 0, function* () {
            const headers = buildCacheHeaders(this.datasource.getDaysToCacheMetadata() * secondsInDay);
            this.metricsMetadata = fixSummariesMetadata(yield this.request('/api/v1/metadata', {}, {}, Object.assign({ showErrorAlert: false }, headers)));
        });
    }
    getLabelKeys() {
        return this.labelKeys;
    }
    getRangeCompletionItems() {
        return {
            context: 'context-range',
            suggestions: [
                {
                    label: 'Range vector',
                    items: [...RATE_RANGES],
                },
            ],
        };
    }
    importFromAbstractQuery(labelBasedQuery) {
        return toPromLikeQuery(labelBasedQuery);
    }
    exportToAbstractQuery(query) {
        const promQuery = query.expr;
        if (!promQuery || promQuery.length === 0) {
            return { refId: query.refId, labelMatchers: [] };
        }
        const tokens = Prism.tokenize(promQuery, PromqlSyntax);
        const labelMatchers = extractLabelMatchers(tokens);
        const nameLabelValue = getNameLabelValue(promQuery, tokens);
        if (nameLabelValue && nameLabelValue.length > 0) {
            labelMatchers.push({
                name: '__name__',
                operator: AbstractLabelOperator.Equal,
                value: nameLabelValue,
            });
        }
        return {
            refId: query.refId,
            labelMatchers,
        };
    }
    getSeries(selector, withName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.datasource.lookupsDisabled) {
                return {};
            }
            try {
                if (selector === EMPTY_SELECTOR) {
                    return yield this.fetchDefaultSeries();
                }
                else {
                    return yield this.fetchSeriesLabels(selector, withName);
                }
            }
            catch (error) {
                // TODO: better error handling
                console.error(error);
                return {};
            }
        });
    }
    getLabelValues(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.fetchLabelValues(key);
        });
    }
    /**
     * Fetches all label keys
     */
    fetchLabels() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = '/api/v1/labels';
            const params = this.datasource.getAdjustedInterval();
            this.labelFetchTs = Date.now().valueOf();
            const res = yield this.request(url, [], params, this.getDefaultCacheHeaders());
            if (Array.isArray(res)) {
                this.labelKeys = res.slice().sort();
            }
            return [];
        });
    }
}
function getNameLabelValue(promQuery, tokens) {
    let nameLabelValue = '';
    for (let prop in tokens) {
        if (typeof tokens[prop] === 'string') {
            nameLabelValue = tokens[prop];
            break;
        }
    }
    return nameLabelValue;
}
//# sourceMappingURL=language_provider.js.map