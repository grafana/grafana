import { __assign, __awaiter, __generator, __read, __spreadArray, __values } from "tslib";
import { rangeUtil, getDefaultRelativeTimeRange, } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { getNextRefIdChar } from 'app/core/utils/query';
import { ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';
import { ExpressionQueryType } from 'app/features/expressions/types';
import { GrafanaAlertStateDecision, } from 'app/types/unified-alerting-dto';
import { EvalFunction } from '../../state/alertDef';
import { RuleFormType } from '../types/rule-form';
import { Annotation } from './constants';
import { isGrafanaRulesSource } from './datasource';
import { arrayToRecord, recordToArray } from './misc';
import { isAlertingRulerRule, isGrafanaRulerRule, isRecordingRulerRule } from './rules';
import { parseInterval } from './time';
export var getDefaultFormValues = function () {
    return Object.freeze({
        name: '',
        labels: [{ key: '', value: '' }],
        annotations: [
            { key: Annotation.summary, value: '' },
            { key: Annotation.description, value: '' },
            { key: Annotation.runbookURL, value: '' },
        ],
        dataSourceName: null,
        type: !contextSrv.isEditor ? RuleFormType.grafana : undefined,
        // grafana
        folder: null,
        queries: [],
        condition: '',
        noDataState: GrafanaAlertStateDecision.NoData,
        execErrState: GrafanaAlertStateDecision.Alerting,
        evaluateEvery: '1m',
        evaluateFor: '5m',
        // cortex / loki
        group: '',
        namespace: '',
        expression: '',
        forTime: 1,
        forTimeUnit: 'm',
    });
};
export function formValuesToRulerRuleDTO(values) {
    var name = values.name, expression = values.expression, forTime = values.forTime, forTimeUnit = values.forTimeUnit, type = values.type;
    if (type === RuleFormType.cloudAlerting) {
        return {
            alert: name,
            for: "" + forTime + forTimeUnit,
            annotations: arrayToRecord(values.annotations || []),
            labels: arrayToRecord(values.labels || []),
            expr: expression,
        };
    }
    else if (type === RuleFormType.cloudRecording) {
        return {
            record: name,
            labels: arrayToRecord(values.labels || []),
            expr: expression,
        };
    }
    throw new Error("unexpected rule type: " + type);
}
function listifyLabelsOrAnnotations(item) {
    return __spreadArray(__spreadArray([], __read(recordToArray(item || {})), false), [{ key: '', value: '' }], false);
}
export function formValuesToRulerGrafanaRuleDTO(values) {
    var name = values.name, condition = values.condition, noDataState = values.noDataState, execErrState = values.execErrState, evaluateFor = values.evaluateFor, queries = values.queries;
    if (condition) {
        return {
            grafana_alert: {
                title: name,
                condition: condition,
                no_data_state: noDataState,
                exec_err_state: execErrState,
                data: queries,
            },
            for: evaluateFor,
            annotations: arrayToRecord(values.annotations || []),
            labels: arrayToRecord(values.labels || []),
        };
    }
    throw new Error('Cannot create rule without specifying alert condition');
}
export function rulerRuleToFormValues(ruleWithLocation) {
    var ruleSourceName = ruleWithLocation.ruleSourceName, namespace = ruleWithLocation.namespace, group = ruleWithLocation.group, rule = ruleWithLocation.rule;
    var defaultFormValues = getDefaultFormValues();
    if (isGrafanaRulesSource(ruleSourceName)) {
        if (isGrafanaRulerRule(rule)) {
            var ga = rule.grafana_alert;
            return __assign(__assign({}, defaultFormValues), { name: ga.title, type: RuleFormType.grafana, evaluateFor: rule.for || '0', evaluateEvery: group.interval || defaultFormValues.evaluateEvery, noDataState: ga.no_data_state, execErrState: ga.exec_err_state, queries: ga.data, condition: ga.condition, annotations: listifyLabelsOrAnnotations(rule.annotations), labels: listifyLabelsOrAnnotations(rule.labels), folder: { title: namespace, id: ga.namespace_id } });
        }
        else {
            throw new Error('Unexpected type of rule for grafana rules source');
        }
    }
    else {
        if (isAlertingRulerRule(rule)) {
            var _a = __read(rule.for
                ? parseInterval(rule.for)
                : [defaultFormValues.forTime, defaultFormValues.forTimeUnit], 2), forTime = _a[0], forTimeUnit = _a[1];
            return __assign(__assign({}, defaultFormValues), { name: rule.alert, type: RuleFormType.cloudAlerting, dataSourceName: ruleSourceName, namespace: namespace, group: group.name, expression: rule.expr, forTime: forTime, forTimeUnit: forTimeUnit, annotations: listifyLabelsOrAnnotations(rule.annotations), labels: listifyLabelsOrAnnotations(rule.labels) });
        }
        else if (isRecordingRulerRule(rule)) {
            return __assign(__assign({}, defaultFormValues), { name: rule.record, type: RuleFormType.cloudRecording, dataSourceName: ruleSourceName, namespace: namespace, group: group.name, expression: rule.expr, labels: listifyLabelsOrAnnotations(rule.labels) });
        }
        else {
            throw new Error('Unexpected type of rule for cloud rules source');
        }
    }
}
export var getDefaultQueries = function () {
    var dataSource = getDataSourceSrv().getInstanceSettings('default');
    if (!dataSource) {
        return [getDefaultExpression('A')];
    }
    var relativeTimeRange = getDefaultRelativeTimeRange();
    return [
        {
            refId: 'A',
            datasourceUid: dataSource.uid,
            queryType: '',
            relativeTimeRange: relativeTimeRange,
            model: {
                refId: 'A',
                hide: false,
            },
        },
        getDefaultExpression('B'),
    ];
};
var getDefaultExpression = function (refId) {
    var model = {
        refId: refId,
        hide: false,
        type: ExpressionQueryType.classic,
        datasource: {
            uid: ExpressionDatasourceUID,
            type: 'grafana-expression',
        },
        conditions: [
            {
                type: 'query',
                evaluator: {
                    params: [3],
                    type: EvalFunction.IsAbove,
                },
                operator: {
                    type: 'and',
                },
                query: {
                    params: ['A'],
                },
                reducer: {
                    params: [],
                    type: 'last',
                },
            },
        ],
    };
    return {
        refId: refId,
        datasourceUid: ExpressionDatasourceUID,
        queryType: '',
        model: model,
    };
};
var dataQueriesToGrafanaQueries = function (queries, relativeTimeRange, scopedVars, panelDataSourceRef, maxDataPoints, minInterval) { return __awaiter(void 0, void 0, void 0, function () {
    var result, queries_1, queries_1_1, target, datasource, dsRef, range, _a, interval, intervalMs, queryVariables, interpolatedTarget, _b, newQuery, datasourceSettings, newQuery, e_1_1;
    var e_1, _c;
    var _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                result = [];
                _f.label = 1;
            case 1:
                _f.trys.push([1, 9, 10, 11]);
                queries_1 = __values(queries), queries_1_1 = queries_1.next();
                _f.label = 2;
            case 2:
                if (!!queries_1_1.done) return [3 /*break*/, 8];
                target = queries_1_1.value;
                return [4 /*yield*/, getDataSourceSrv().get(((_d = target.datasource) === null || _d === void 0 ? void 0 : _d.uid) ? target.datasource : panelDataSourceRef)];
            case 3:
                datasource = _f.sent();
                dsRef = { uid: datasource.uid, type: datasource.type };
                range = rangeUtil.relativeToTimeRange(relativeTimeRange);
                _a = getIntervals(range, minInterval !== null && minInterval !== void 0 ? minInterval : datasource.interval, maxDataPoints), interval = _a.interval, intervalMs = _a.intervalMs;
                queryVariables = __assign({ __interval: { text: interval, value: interval }, __interval_ms: { text: intervalMs, value: intervalMs } }, scopedVars);
                if (!datasource.interpolateVariablesInQueries) return [3 /*break*/, 5];
                return [4 /*yield*/, datasource.interpolateVariablesInQueries([target], queryVariables)[0]];
            case 4:
                _b = _f.sent();
                return [3 /*break*/, 6];
            case 5:
                _b = target;
                _f.label = 6;
            case 6:
                interpolatedTarget = _b;
                // expressions
                if (dsRef.uid === ExpressionDatasourceUID) {
                    newQuery = {
                        refId: interpolatedTarget.refId,
                        queryType: '',
                        relativeTimeRange: relativeTimeRange,
                        datasourceUid: ExpressionDatasourceUID,
                        model: interpolatedTarget,
                    };
                    result.push(newQuery);
                    // queries
                }
                else {
                    datasourceSettings = getDataSourceSrv().getInstanceSettings(dsRef);
                    if (datasourceSettings && datasourceSettings.meta.alerting) {
                        newQuery = {
                            refId: interpolatedTarget.refId,
                            queryType: (_e = interpolatedTarget.queryType) !== null && _e !== void 0 ? _e : '',
                            relativeTimeRange: relativeTimeRange,
                            datasourceUid: datasourceSettings.uid,
                            model: __assign(__assign({}, interpolatedTarget), { maxDataPoints: maxDataPoints, intervalMs: intervalMs }),
                        };
                        result.push(newQuery);
                    }
                }
                _f.label = 7;
            case 7:
                queries_1_1 = queries_1.next();
                return [3 /*break*/, 2];
            case 8: return [3 /*break*/, 11];
            case 9:
                e_1_1 = _f.sent();
                e_1 = { error: e_1_1 };
                return [3 /*break*/, 11];
            case 10:
                try {
                    if (queries_1_1 && !queries_1_1.done && (_c = queries_1.return)) _c.call(queries_1);
                }
                finally { if (e_1) throw e_1.error; }
                return [7 /*endfinally*/];
            case 11: return [2 /*return*/, result];
        }
    });
}); };
export var panelToRuleFormValues = function (panel, dashboard) { return __awaiter(void 0, void 0, void 0, function () {
    var targets, relativeTimeRange, queries, _a, folderId, folderTitle, formValues;
    var _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                targets = panel.targets;
                if (!panel.id || !dashboard.uid) {
                    return [2 /*return*/, undefined];
                }
                relativeTimeRange = rangeUtil.timeRangeToRelative(rangeUtil.convertRawToRange(dashboard.time));
                return [4 /*yield*/, dataQueriesToGrafanaQueries(targets, relativeTimeRange, panel.scopedVars || {}, (_b = panel.datasource) !== null && _b !== void 0 ? _b : undefined, (_c = panel.maxDataPoints) !== null && _c !== void 0 ? _c : undefined, (_d = panel.interval) !== null && _d !== void 0 ? _d : undefined)];
            case 1:
                queries = _e.sent();
                // if no alerting capable queries are found, can't create a rule
                if (!queries.length || !queries.find(function (query) { return query.datasourceUid !== ExpressionDatasourceUID; })) {
                    return [2 /*return*/, undefined];
                }
                if (!queries.find(function (query) { return query.datasourceUid === ExpressionDatasourceUID; })) {
                    queries.push(getDefaultExpression(getNextRefIdChar(queries.map(function (query) { return query.model; }))));
                }
                _a = dashboard.meta, folderId = _a.folderId, folderTitle = _a.folderTitle;
                formValues = {
                    type: RuleFormType.grafana,
                    folder: folderId && folderTitle
                        ? {
                            id: folderId,
                            title: folderTitle,
                        }
                        : undefined,
                    queries: queries,
                    name: panel.title,
                    condition: queries[queries.length - 1].refId,
                    annotations: [
                        {
                            key: Annotation.dashboardUID,
                            value: dashboard.uid,
                        },
                        {
                            key: Annotation.panelID,
                            value: String(panel.id),
                        },
                    ],
                };
                return [2 /*return*/, formValues];
        }
    });
}); };
export function getIntervals(range, lowLimit, resolution) {
    if (!resolution) {
        if (lowLimit && rangeUtil.intervalToMs(lowLimit) > 1000) {
            return {
                interval: lowLimit,
                intervalMs: rangeUtil.intervalToMs(lowLimit),
            };
        }
        return { interval: '1s', intervalMs: 1000 };
    }
    return rangeUtil.calculateInterval(range, resolution, lowLimit);
}
//# sourceMappingURL=rule-form.js.map