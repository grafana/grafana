import { __awaiter } from "tslib";
import { chain, difference } from 'lodash';
import { LRUCache } from 'lru-cache';
import Prism from 'prismjs';
import { dateTime, LanguageProvider } from '@grafana/data';
import { extractLabelMatchers, parseSelector, processLabels, toPromLikeExpr, } from 'app/plugins/datasource/prometheus/language_utils';
import { extractLabelKeysFromDataFrame, extractLogParserFromDataFrame, extractUnwrapLabelKeysFromDataFrame, } from './responseUtils';
import syntax, { FUNCTIONS, PIPE_PARSERS, PIPE_OPERATORS } from './syntax';
import { LokiQueryType } from './types';
const DEFAULT_KEYS = ['job', 'namespace'];
const EMPTY_SELECTOR = '{}';
const HISTORY_ITEM_COUNT = 10;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
const NS_IN_MS = 1000000;
// When changing RATE_RANGES, check if Prometheus/PromQL ranges should be changed too
// @see public/app/plugins/datasource/prometheus/promql.ts
const RATE_RANGES = [
    { label: '$__auto', sortValue: '$__auto' },
    { label: '1m', sortValue: '00:01:00' },
    { label: '5m', sortValue: '00:05:00' },
    { label: '10m', sortValue: '00:10:00' },
    { label: '30m', sortValue: '00:30:00' },
    { label: '1h', sortValue: '01:00:00' },
    { label: '1d', sortValue: '24:00:00' },
];
export const LABEL_REFRESH_INTERVAL = 1000 * 30; // 30sec
const wrapLabel = (label) => ({ label, filterText: `\"${label}\"` });
export function addHistoryMetadata(item, history) {
    const cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
    const historyForItem = history.filter((h) => h.ts > cutoffTs && h.query.expr === item.label);
    let hint = `Queried ${historyForItem.length} times in the last 24h.`;
    const recent = historyForItem[0];
    if (recent) {
        const lastQueried = dateTime(recent.ts).fromNow();
        hint = `${hint} Last queried ${lastQueried}.`;
    }
    return Object.assign(Object.assign({}, item), { documentation: hint });
}
export default class LokiLanguageProvider extends LanguageProvider {
    constructor(datasource, initialValues) {
        super();
        this.started = false;
        this.lookupsDisabled = false; // Dynamically set to true for big/slow instances
        /**
         *  Cache for labels of series. This is bit simplistic in the sense that it just counts responses each as a 1 and does
         *  not account for different size of a response. If that is needed a `length` function can be added in the options.
         *  10 as a max size is totally arbitrary right now.
         */
        this.seriesCache = new LRUCache({ max: 10 });
        this.labelsCache = new LRUCache({ max: 10 });
        // Strip syntax chars
        this.cleanText = (s) => s.replace(/[{}[\]="(),!~+\-*/^%\|]/g, '').trim();
        this.request = (url, params) => __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.datasource.metadataRequest(url, params);
            }
            catch (error) {
                console.error(error);
            }
            return undefined;
        });
        /**
         * Initialise the language provider by fetching set of labels. Without this initialisation the provider would return
         * just a set of hardcoded default labels on provideCompletionItems or a recent queries from history.
         */
        this.start = () => {
            if (!this.startTask) {
                this.startTask = this.fetchLabels().then(() => {
                    this.started = true;
                    return [];
                });
            }
            return this.startTask;
        };
        this.getBeginningCompletionItems = (context) => {
            return {
                suggestions: [...this.getEmptyCompletionItems(context).suggestions, ...this.getTermCompletionItems().suggestions],
            };
        };
        this.getTermCompletionItems = () => {
            const suggestions = [];
            suggestions.push({
                prefixMatch: true,
                label: 'Functions',
                items: FUNCTIONS.map((suggestion) => (Object.assign(Object.assign({}, suggestion), { kind: 'function' }))),
            });
            return { suggestions };
        };
        this.getPipeCompletionItem = () => {
            const suggestions = [];
            suggestions.push({
                label: 'Operators',
                items: PIPE_OPERATORS.map((suggestion) => (Object.assign(Object.assign({}, suggestion), { kind: 'operators' }))),
            });
            suggestions.push({
                label: 'Parsers',
                items: PIPE_PARSERS.map((suggestion) => (Object.assign(Object.assign({}, suggestion), { kind: 'parsers' }))),
            });
            return { suggestions };
        };
        /**
         * Fetch series labels for a selector
         *
         * This method fetches labels for a given stream selector, such as `{job="grafana"}`.
         * It returns a promise that resolves to a record mapping label names to their corresponding values.
         *
         * @param streamSelector - The stream selector for which you want to retrieve labels.
         * @returns A promise containing a record of label names and their values.
         * @throws An error if the fetch operation fails.
         */
        this.fetchSeriesLabels = (streamSelector) => __awaiter(this, void 0, void 0, function* () {
            const interpolatedMatch = this.datasource.interpolateString(streamSelector);
            const url = 'series';
            const { start, end } = this.datasource.getTimeRangeParams();
            const cacheKey = this.generateCacheKey(url, start, end, interpolatedMatch);
            let value = this.seriesCache.get(cacheKey);
            if (!value) {
                const params = { 'match[]': interpolatedMatch, start, end };
                const data = yield this.request(url, params);
                const { values } = processLabels(data);
                value = values;
                this.seriesCache.set(cacheKey, value);
            }
            return value;
        });
        /**
         * Fetch series for a selector. Use this for raw results. Use fetchSeriesLabels() to get labels.
         * @param match
         */
        this.fetchSeries = (match) => __awaiter(this, void 0, void 0, function* () {
            const url = 'series';
            const { start, end } = this.datasource.getTimeRangeParams();
            const params = { 'match[]': match, start, end };
            return yield this.request(url, params);
        });
        this.datasource = datasource;
        this.labelKeys = [];
        this.labelFetchTs = 0;
        Object.assign(this, initialValues);
    }
    getSyntax() {
        return syntax;
    }
    getLabelKeys() {
        return this.labelKeys;
    }
    /**
     * Return suggestions based on input that can be then plugged into a typeahead dropdown.
     * Keep this DOM-free for testing
     * @param input
     * @param context Is optional in types but is required in case we are doing getLabelCompletionItems
     * @param context.absoluteRange Required in case we are doing getLabelCompletionItems
     * @param context.history Optional used only in getEmptyCompletionItems
     */
    provideCompletionItems(input, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const { wrapperClasses, value, prefix, text } = input;
            const emptyResult = { suggestions: [] };
            if (!value) {
                return emptyResult;
            }
            // Local text properties
            const empty = (value === null || value === void 0 ? void 0 : value.document.text.length) === 0;
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
            const safePrefix = prefix && !text.match(/^['"~=\]})\s]+$/) && noSuffix;
            // About to type next operand if preceded by binary operator
            const operatorsPattern = /[+\-*/^%]/;
            const isNextOperand = text.match(operatorsPattern);
            // Determine candidates by CSS context
            if (wrapperClasses.includes('context-range')) {
                // Suggestions for metric[|]
                return this.getRangeCompletionItems();
            }
            else if (wrapperClasses.includes('context-labels')) {
                // Suggestions for {|} and {foo=|}
                return yield this.getLabelCompletionItems(input);
            }
            else if (wrapperClasses.includes('context-pipe')) {
                return this.getPipeCompletionItem();
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
    }
    getEmptyCompletionItems(context) {
        const history = context === null || context === void 0 ? void 0 : context.history;
        const suggestions = [];
        if (history === null || history === void 0 ? void 0 : history.length) {
            const historyItems = chain(history)
                .map((h) => h.query.expr)
                .filter()
                .uniq()
                .take(HISTORY_ITEM_COUNT)
                .map(wrapLabel)
                .map((item) => addHistoryMetadata(item, history))
                .value();
            suggestions.push({
                prefixMatch: true,
                skipSort: true,
                label: 'History',
                items: historyItems,
            });
        }
        return { suggestions };
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
    getLabelCompletionItems({ text, wrapperClasses, labelKey, value }) {
        return __awaiter(this, void 0, void 0, function* () {
            let context = 'context-labels';
            const suggestions = [];
            if (!value) {
                return { context, suggestions: [] };
            }
            const line = value.anchorBlock.getText();
            const cursorOffset = value.selection.anchor.offset;
            const isValueStart = text.match(/^(=|=~|!=|!~)/);
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
            if (!labelKey && selector === EMPTY_SELECTOR) {
                // start task gets all labels
                yield this.start();
                const allLabels = this.getLabelKeys();
                return { context, suggestions: [{ label: `Labels`, items: allLabels.map(wrapLabel) }] };
            }
            const existingKeys = parsedSelector ? parsedSelector.labelKeys : [];
            let labelValues;
            // Query labels for selector
            if (selector) {
                if (selector === EMPTY_SELECTOR && labelKey) {
                    const labelValuesForKey = yield this.getLabelValues(labelKey);
                    labelValues = { [labelKey]: labelValuesForKey };
                }
                else {
                    labelValues = yield this.getSeriesLabels(selector);
                }
            }
            if (!labelValues) {
                console.warn(`Server did not return any values for selector = ${selector}`);
                return { context, suggestions };
            }
            if ((text && isValueStart) || wrapperClasses.includes('attr-value')) {
                // Label values
                if (labelKey && labelValues[labelKey]) {
                    context = 'context-label-values';
                    suggestions.push({
                        label: `Label values for "${labelKey}"`,
                        // Filter to prevent previously selected values from being repeatedly suggested
                        items: labelValues[labelKey].map(wrapLabel).filter(({ filterText }) => filterText !== text),
                    });
                }
            }
            else {
                // Label keys
                const labelKeys = labelValues ? Object.keys(labelValues) : DEFAULT_KEYS;
                if (labelKeys) {
                    const possibleKeys = difference(labelKeys, existingKeys);
                    if (possibleKeys.length) {
                        const newItems = possibleKeys.map((key) => ({ label: key }));
                        const newSuggestion = { label: `Labels`, items: newItems };
                        suggestions.push(newSuggestion);
                    }
                }
            }
            return { context, suggestions };
        });
    }
    importFromAbstractQuery(labelBasedQuery) {
        return {
            refId: labelBasedQuery.refId,
            expr: toPromLikeExpr(labelBasedQuery),
            queryType: LokiQueryType.Range,
        };
    }
    exportToAbstractQuery(query) {
        const lokiQuery = query.expr;
        if (!lokiQuery || lokiQuery.length === 0) {
            return { refId: query.refId, labelMatchers: [] };
        }
        const tokens = Prism.tokenize(lokiQuery, syntax);
        return {
            refId: query.refId,
            labelMatchers: extractLabelMatchers(tokens),
        };
    }
    getSeriesLabels(selector) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.lookupsDisabled) {
                return undefined;
            }
            try {
                return yield this.fetchSeriesLabels(selector);
            }
            catch (error) {
                // TODO: better error handling
                console.error(error);
                return undefined;
            }
        });
    }
    /**
     * Fetch all label keys
     * This asynchronous function returns all available label keys from the data source.
     * It returns a promise that resolves to an array of strings containing the label keys.
     *
     * @returns A promise containing an array of label keys.
     * @throws An error if the fetch operation fails.
     */
    fetchLabels() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = 'labels';
            const timeRange = this.datasource.getTimeRangeParams();
            this.labelFetchTs = Date.now().valueOf();
            const res = yield this.request(url, timeRange);
            if (Array.isArray(res)) {
                const labels = res
                    .slice()
                    .sort()
                    .filter((label) => label !== '__name__');
                this.labelKeys = labels;
                return this.labelKeys;
            }
            return [];
        });
    }
    // Cache key is a bit different here. We round up to a minute the intervals.
    // The rounding may seem strange but makes relative intervals like now-1h less prone to need separate request every
    // millisecond while still actually getting all the keys for the correct interval. This still can create problems
    // when user does not the newest values for a minute if already cached.
    generateCacheKey(url, start, end, param) {
        return [url, this.roundTime(start), this.roundTime(end), param].join();
    }
    // Round nanos epoch to nearest 5 minute interval
    roundTime(nanos) {
        return nanos ? Math.floor(nanos / NS_IN_MS / 1000 / 60 / 5) : 0;
    }
    getLabelValues(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.fetchLabelValues(key);
        });
    }
    /**
     * Fetch label values
     *
     * This asynchronous function fetches values associated with a specified label name.
     * It returns a promise that resolves to an array of strings containing the label values.
     *
     * @param labelName - The name of the label for which you want to retrieve values.
     * @returns A promise containing an array of label values.
     * @throws An error if the fetch operation fails.
     */
    fetchLabelValues(labelName) {
        return __awaiter(this, void 0, void 0, function* () {
            const interpolatedKey = encodeURIComponent(this.datasource.interpolateString(labelName));
            const url = `label/${interpolatedKey}/values`;
            const rangeParams = this.datasource.getTimeRangeParams();
            const { start, end } = rangeParams;
            const cacheKey = this.generateCacheKey(url, start, end, interpolatedKey);
            const params = { start, end };
            let labelValues = this.labelsCache.get(cacheKey);
            if (!labelValues) {
                // Clear value when requesting new one. Empty object being truthy also makes sure we don't request twice.
                this.labelsCache.set(cacheKey, []);
                const res = yield this.request(url, params);
                if (Array.isArray(res)) {
                    labelValues = res.slice().sort();
                    this.labelsCache.set(cacheKey, labelValues);
                }
            }
            return labelValues !== null && labelValues !== void 0 ? labelValues : [];
        });
    }
    /**
     * Get parser and label keys for a selector
     *
     * This asynchronous function is used to fetch parsers and label keys for a selected log stream based on sampled lines.
     * It returns a promise that resolves to an object with the following properties:
     *
     * - `extractedLabelKeys`: An array of available label keys associated with the log stream.
     * - `hasJSON`: A boolean indicating whether JSON parsing is available for the stream.
     * - `hasLogfmt`: A boolean indicating whether Logfmt parsing is available for the stream.
     * - `hasPack`: A boolean indicating whether Pack parsing is available for the stream.
     * - `unwrapLabelKeys`: An array of label keys that can be used for unwrapping log data.
     *
     * @param streamSelector - The selector for the log stream you want to analyze.
     * @returns A promise containing an object with parser and label key information.
     * @throws An error if the fetch operation fails.
     */
    getParserAndLabelKeys(streamSelector) {
        return __awaiter(this, void 0, void 0, function* () {
            const series = yield this.datasource.getDataSamples({ expr: streamSelector, refId: 'data-samples' });
            if (!series.length) {
                return { extractedLabelKeys: [], unwrapLabelKeys: [], hasJSON: false, hasLogfmt: false, hasPack: false };
            }
            const { hasLogfmt, hasJSON, hasPack } = extractLogParserFromDataFrame(series[0]);
            return {
                extractedLabelKeys: extractLabelKeysFromDataFrame(series[0]),
                unwrapLabelKeys: extractUnwrapLabelKeysFromDataFrame(series[0]),
                hasJSON,
                hasPack,
                hasLogfmt,
            };
        });
    }
}
//# sourceMappingURL=LanguageProvider.js.map