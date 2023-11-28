import { __awaiter } from "tslib";
import { escapeLabelValueInExactSelector } from '../../../language_utils';
import { FUNCTIONS } from '../../../promql';
import { NeverCaseError } from './util';
// we order items like: history, functions, metrics
function getAllMetricNamesCompletions(dataProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        const metrics = yield dataProvider.getAllMetricNames();
        return metrics.map((metric) => ({
            type: 'METRIC_NAME',
            label: metric.name,
            insertText: metric.name,
            detail: `${metric.name} : ${metric.type}`,
            documentation: metric.help,
        }));
    });
}
const FUNCTION_COMPLETIONS = FUNCTIONS.map((f) => {
    var _a;
    return ({
        type: 'FUNCTION',
        label: f.label,
        insertText: (_a = f.insertText) !== null && _a !== void 0 ? _a : '',
        detail: f.detail,
        documentation: f.documentation,
    });
});
function getAllFunctionsAndMetricNamesCompletions(dataProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        const metricNames = yield getAllMetricNamesCompletions(dataProvider);
        return [...FUNCTION_COMPLETIONS, ...metricNames];
    });
}
const DURATION_COMPLETIONS = [
    '$__interval',
    '$__range',
    '$__rate_interval',
    '1m',
    '5m',
    '10m',
    '30m',
    '1h',
    '1d',
].map((text) => ({
    type: 'DURATION',
    label: text,
    insertText: text,
}));
function getAllHistoryCompletions(dataProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        // function getAllHistoryCompletions(queryHistory: PromHistoryItem[]): Completion[] {
        // NOTE: the typescript types are wrong. historyItem.query.expr can be undefined
        const allHistory = yield dataProvider.getHistory();
        // FIXME: find a better history-limit
        return allHistory.slice(0, 10).map((expr) => ({
            type: 'HISTORY',
            label: expr,
            insertText: expr,
        }));
    });
}
function makeSelector(metricName, labels) {
    const allLabels = [...labels];
    // we transform the metricName to a label, if it exists
    if (metricName !== undefined) {
        allLabels.push({ name: '__name__', value: metricName, op: '=' });
    }
    const allLabelTexts = allLabels.map((label) => `${label.name}${label.op}"${escapeLabelValueInExactSelector(label.value)}"`);
    return `{${allLabelTexts.join(',')}}`;
}
function getLabelNames(metric, otherLabels, dataProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        if (metric === undefined && otherLabels.length === 0) {
            // if there is no filtering, we have to use a special endpoint
            return dataProvider.getAllLabelNames();
        }
        else {
            const selector = makeSelector(metric, otherLabels);
            return yield dataProvider.getSeriesLabels(selector, otherLabels);
        }
    });
}
function getLabelNamesForCompletions(metric, suffix, triggerOnInsert, otherLabels, dataProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        const labelNames = yield getLabelNames(metric, otherLabels, dataProvider);
        return labelNames.map((text) => ({
            type: 'LABEL_NAME',
            label: text,
            insertText: `${text}${suffix}`,
            triggerOnInsert,
        }));
    });
}
function getLabelNamesForSelectorCompletions(metric, otherLabels, dataProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        return getLabelNamesForCompletions(metric, '=', true, otherLabels, dataProvider);
    });
}
function getLabelNamesForByCompletions(metric, otherLabels, dataProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        return getLabelNamesForCompletions(metric, '', false, otherLabels, dataProvider);
    });
}
function getLabelValues(metric, labelName, otherLabels, dataProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        if (metric === undefined && otherLabels.length === 0) {
            // if there is no filtering, we have to use a special endpoint
            return dataProvider.getLabelValues(labelName);
        }
        else {
            const selector = makeSelector(metric, otherLabels);
            return yield dataProvider.getSeriesValues(labelName, selector);
        }
    });
}
function getLabelValuesForMetricCompletions(metric, labelName, betweenQuotes, otherLabels, dataProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        const values = yield getLabelValues(metric, labelName, otherLabels, dataProvider);
        return values.map((text) => ({
            type: 'LABEL_VALUE',
            label: text,
            insertText: betweenQuotes ? text : `"${text}"`, // FIXME: escaping strange characters?
        }));
    });
}
export function getCompletions(situation, dataProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        switch (situation.type) {
            case 'IN_DURATION':
                return DURATION_COMPLETIONS;
            case 'IN_FUNCTION':
                return getAllFunctionsAndMetricNamesCompletions(dataProvider);
            case 'AT_ROOT': {
                return getAllFunctionsAndMetricNamesCompletions(dataProvider);
            }
            case 'EMPTY': {
                const metricNames = yield getAllMetricNamesCompletions(dataProvider);
                const historyCompletions = yield getAllHistoryCompletions(dataProvider);
                return [...historyCompletions, ...FUNCTION_COMPLETIONS, ...metricNames];
            }
            case 'IN_LABEL_SELECTOR_NO_LABEL_NAME':
                return getLabelNamesForSelectorCompletions(situation.metricName, situation.otherLabels, dataProvider);
            case 'IN_GROUPING':
                return getLabelNamesForByCompletions(situation.metricName, situation.otherLabels, dataProvider);
            case 'IN_LABEL_SELECTOR_WITH_LABEL_NAME':
                return getLabelValuesForMetricCompletions(situation.metricName, situation.labelName, situation.betweenQuotes, situation.otherLabels, dataProvider);
            default:
                throw new NeverCaseError(situation);
        }
    });
}
//# sourceMappingURL=completions.js.map