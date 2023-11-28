import { __awaiter } from "tslib";
import { omit } from 'lodash';
import { getDefaultRelativeTimeRange, rangeUtil, } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { getNextRefIdChar } from 'app/core/utils/query';
import { ExpressionDatasourceUID, ExpressionQueryType } from 'app/features/expressions/types';
import { GrafanaAlertStateDecision, } from 'app/types/unified-alerting-dto';
import { EvalFunction } from '../../state/alertDef';
import { RuleFormType } from '../types/rule-form';
import { getRulesAccess } from './access-control';
import { Annotation, defaultAnnotations } from './constants';
import { getDefaultOrFirstCompatibleDataSource, isGrafanaRulesSource } from './datasource';
import { arrayToRecord, recordToArray } from './misc';
import { isAlertingRulerRule, isGrafanaRulerRule, isRecordingRulerRule } from './rules';
import { parseInterval } from './time';
export const MINUTE = '1m';
export const getDefaultFormValues = () => {
    const { canCreateGrafanaRules, canCreateCloudRules } = getRulesAccess();
    return Object.freeze({
        name: '',
        uid: '',
        labels: [{ key: '', value: '' }],
        annotations: defaultAnnotations,
        dataSourceName: null,
        type: canCreateGrafanaRules ? RuleFormType.grafana : canCreateCloudRules ? RuleFormType.cloudAlerting : undefined,
        group: '',
        // grafana
        folder: null,
        queries: [],
        recordingRulesQueries: [],
        condition: '',
        noDataState: GrafanaAlertStateDecision.NoData,
        execErrState: GrafanaAlertStateDecision.Error,
        evaluateFor: '5m',
        evaluateEvery: MINUTE,
        // cortex / loki
        namespace: '',
        expression: '',
        forTime: 1,
        forTimeUnit: 'm',
        // @PERCONA
        // templated rules
        ruleName: '',
        template: null,
        duration: '1m',
        filters: [],
        severity: null,
    });
};
export function formValuesToRulerRuleDTO(values) {
    const { name, expression, forTime, forTimeUnit, keepFiringForTime, keepFiringForTimeUnit, type } = values;
    if (type === RuleFormType.cloudAlerting) {
        let keepFiringFor;
        if (keepFiringForTime && keepFiringForTimeUnit) {
            keepFiringFor = `${keepFiringForTime}${keepFiringForTimeUnit}`;
        }
        return {
            alert: name,
            for: `${forTime}${forTimeUnit}`,
            keep_firing_for: keepFiringFor,
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
    throw new Error(`unexpected rule type: ${type}`);
}
export function listifyLabelsOrAnnotations(item, addEmpty) {
    const list = [...recordToArray(item || {})];
    if (addEmpty) {
        list.push({ key: '', value: '' });
    }
    return list;
}
//make sure default annotations are always shown in order even if empty
export function normalizeDefaultAnnotations(annotations) {
    const orderedAnnotations = [...annotations];
    const defaultAnnotationKeys = defaultAnnotations.map((annotation) => annotation.key);
    defaultAnnotationKeys.forEach((defaultAnnotationKey, index) => {
        const fieldIndex = orderedAnnotations.findIndex((field) => field.key === defaultAnnotationKey);
        if (fieldIndex === -1) {
            //add the default annotation if abstent
            const emptyValue = { key: defaultAnnotationKey, value: '' };
            orderedAnnotations.splice(index, 0, emptyValue);
        }
        else if (fieldIndex !== index) {
            //move it to the correct position if present
            orderedAnnotations.splice(index, 0, orderedAnnotations.splice(fieldIndex, 1)[0]);
        }
    });
    return orderedAnnotations;
}
export function formValuesToRulerGrafanaRuleDTO(values) {
    const { name, condition, noDataState, execErrState, evaluateFor, queries, isPaused } = values;
    if (condition) {
        return {
            grafana_alert: {
                title: name,
                condition,
                no_data_state: noDataState,
                exec_err_state: execErrState,
                data: queries.map(fixBothInstantAndRangeQuery),
                is_paused: Boolean(isPaused),
            },
            for: evaluateFor,
            annotations: arrayToRecord(values.annotations || []),
            labels: arrayToRecord(values.labels || []),
        };
    }
    throw new Error('Cannot create rule without specifying alert condition');
}
export function rulerRuleToFormValues(ruleWithLocation) {
    var _a, _b;
    const { ruleSourceName, namespace, group, rule } = ruleWithLocation;
    const defaultFormValues = getDefaultFormValues();
    if (isGrafanaRulesSource(ruleSourceName)) {
        if (isGrafanaRulerRule(rule)) {
            const ga = rule.grafana_alert;
            return Object.assign(Object.assign({}, defaultFormValues), { name: ga.title, type: RuleFormType.grafana, group: group.name, evaluateEvery: group.interval || defaultFormValues.evaluateEvery, evaluateFor: rule.for || '0', noDataState: ga.no_data_state, execErrState: ga.exec_err_state, queries: ga.data, condition: ga.condition, annotations: normalizeDefaultAnnotations(listifyLabelsOrAnnotations(rule.annotations, false)), labels: listifyLabelsOrAnnotations(rule.labels, true), folder: { title: namespace, uid: ga.namespace_uid }, isPaused: ga.is_paused });
        }
        else {
            throw new Error('Unexpected type of rule for grafana rules source');
        }
    }
    else {
        if (isAlertingRulerRule(rule)) {
            const datasourceUid = (_b = (_a = getDataSourceSrv().getInstanceSettings(ruleSourceName)) === null || _a === void 0 ? void 0 : _a.uid) !== null && _b !== void 0 ? _b : '';
            const defaultQuery = {
                refId: 'A',
                datasourceUid,
                queryType: '',
                relativeTimeRange: getDefaultRelativeTimeRange(),
                expr: rule.expr,
                model: {
                    refId: 'A',
                    hide: false,
                    expr: rule.expr,
                },
            };
            const alertingRuleValues = alertingRulerRuleToRuleForm(rule);
            return Object.assign(Object.assign(Object.assign({}, defaultFormValues), alertingRuleValues), { queries: [defaultQuery], annotations: normalizeDefaultAnnotations(listifyLabelsOrAnnotations(rule.annotations, false)), type: RuleFormType.cloudAlerting, dataSourceName: ruleSourceName, namespace, group: group.name });
        }
        else if (isRecordingRulerRule(rule)) {
            const recordingRuleValues = recordingRulerRuleToRuleForm(rule);
            return Object.assign(Object.assign(Object.assign({}, defaultFormValues), recordingRuleValues), { type: RuleFormType.cloudRecording, dataSourceName: ruleSourceName, namespace, group: group.name });
        }
        else {
            throw new Error('Unexpected type of rule for cloud rules source');
        }
    }
}
export function alertingRulerRuleToRuleForm(rule) {
    const defaultFormValues = getDefaultFormValues();
    const [forTime, forTimeUnit] = rule.for
        ? parseInterval(rule.for)
        : [defaultFormValues.forTime, defaultFormValues.forTimeUnit];
    const [keepFiringForTime, keepFiringForTimeUnit] = rule.keep_firing_for
        ? parseInterval(rule.keep_firing_for)
        : [defaultFormValues.keepFiringForTime, defaultFormValues.keepFiringForTimeUnit];
    return {
        name: rule.alert,
        expression: rule.expr,
        forTime,
        forTimeUnit,
        keepFiringForTime,
        keepFiringForTimeUnit,
        annotations: listifyLabelsOrAnnotations(rule.annotations, false),
        labels: listifyLabelsOrAnnotations(rule.labels, true),
    };
}
export function recordingRulerRuleToRuleForm(rule) {
    return {
        name: rule.record,
        expression: rule.expr,
        labels: listifyLabelsOrAnnotations(rule.labels, true),
    };
}
export const getDefaultQueries = () => {
    const dataSource = getDefaultOrFirstCompatibleDataSource();
    if (!dataSource) {
        return [...getDefaultExpressions('A', 'B')];
    }
    const relativeTimeRange = getDefaultRelativeTimeRange();
    return [
        {
            refId: 'A',
            datasourceUid: dataSource.uid,
            queryType: '',
            relativeTimeRange,
            model: {
                refId: 'A',
            },
        },
        ...getDefaultExpressions('B', 'C'),
    ];
};
export const getDefaultRecordingRulesQueries = (rulesSourcesWithRuler) => {
    var _a;
    const relativeTimeRange = getDefaultRelativeTimeRange();
    return [
        {
            refId: 'A',
            datasourceUid: ((_a = rulesSourcesWithRuler[0]) === null || _a === void 0 ? void 0 : _a.uid) || '',
            queryType: '',
            relativeTimeRange,
            model: {
                refId: 'A',
            },
        },
    ];
};
const getDefaultExpressions = (...refIds) => {
    const refOne = refIds[0];
    const refTwo = refIds[1];
    const reduceExpression = {
        refId: refIds[0],
        type: ExpressionQueryType.reduce,
        datasource: {
            uid: ExpressionDatasourceUID,
            type: ExpressionDatasourceRef.type,
        },
        conditions: [
            {
                type: 'query',
                evaluator: {
                    params: [],
                    type: EvalFunction.IsAbove,
                },
                operator: {
                    type: 'and',
                },
                query: {
                    params: [refOne],
                },
                reducer: {
                    params: [],
                    type: 'last',
                },
            },
        ],
        reducer: 'last',
        expression: 'A',
    };
    const thresholdExpression = {
        refId: refTwo,
        type: ExpressionQueryType.threshold,
        datasource: {
            uid: ExpressionDatasourceUID,
            type: ExpressionDatasourceRef.type,
        },
        conditions: [
            {
                type: 'query',
                evaluator: {
                    params: [0],
                    type: EvalFunction.IsAbove,
                },
                operator: {
                    type: 'and',
                },
                query: {
                    params: [refTwo],
                },
                reducer: {
                    params: [],
                    type: 'last',
                },
            },
        ],
        expression: refOne,
    };
    return [
        {
            refId: refOne,
            datasourceUid: ExpressionDatasourceUID,
            queryType: '',
            model: reduceExpression,
        },
        {
            refId: refTwo,
            datasourceUid: ExpressionDatasourceUID,
            queryType: '',
            model: thresholdExpression,
        },
    ];
};
const dataQueriesToGrafanaQueries = (queries, relativeTimeRange, scopedVars, panelDataSourceRef, maxDataPoints, minInterval) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const result = [];
    for (const target of queries) {
        const datasource = yield getDataSourceSrv().get(((_a = target.datasource) === null || _a === void 0 ? void 0 : _a.uid) ? target.datasource : panelDataSourceRef);
        const dsRef = { uid: datasource.uid, type: datasource.type };
        const range = rangeUtil.relativeToTimeRange(relativeTimeRange);
        const { interval, intervalMs } = getIntervals(range, minInterval !== null && minInterval !== void 0 ? minInterval : datasource.interval, maxDataPoints);
        const queryVariables = Object.assign({ __interval: { text: interval, value: interval }, __interval_ms: { text: intervalMs, value: intervalMs } }, scopedVars);
        const interpolatedTarget = datasource.interpolateVariablesInQueries
            ? yield datasource.interpolateVariablesInQueries([target], queryVariables)[0]
            : target;
        // expressions
        if (dsRef.uid === ExpressionDatasourceUID) {
            const newQuery = {
                refId: interpolatedTarget.refId,
                queryType: '',
                relativeTimeRange,
                datasourceUid: ExpressionDatasourceUID,
                model: interpolatedTarget,
            };
            result.push(newQuery);
            // queries
        }
        else {
            const datasourceSettings = getDataSourceSrv().getInstanceSettings(dsRef);
            if (datasourceSettings && datasourceSettings.meta.alerting) {
                const newQuery = {
                    refId: interpolatedTarget.refId,
                    queryType: (_b = interpolatedTarget.queryType) !== null && _b !== void 0 ? _b : '',
                    relativeTimeRange,
                    datasourceUid: datasourceSettings.uid,
                    model: Object.assign(Object.assign({}, interpolatedTarget), { maxDataPoints,
                        intervalMs }),
                };
                result.push(newQuery);
            }
        }
    }
    return result;
});
export const panelToRuleFormValues = (panel, dashboard) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d, _e;
    const { targets } = panel;
    if (!panel.id || !dashboard.uid) {
        return undefined;
    }
    const relativeTimeRange = rangeUtil.timeRangeToRelative(rangeUtil.convertRawToRange(dashboard.time));
    const queries = yield dataQueriesToGrafanaQueries(targets, relativeTimeRange, panel.scopedVars || {}, (_c = panel.datasource) !== null && _c !== void 0 ? _c : undefined, (_d = panel.maxDataPoints) !== null && _d !== void 0 ? _d : undefined, (_e = panel.interval) !== null && _e !== void 0 ? _e : undefined);
    // if no alerting capable queries are found, can't create a rule
    if (!queries.length || !queries.find((query) => query.datasourceUid !== ExpressionDatasourceUID)) {
        return undefined;
    }
    if (!queries.find((query) => query.datasourceUid === ExpressionDatasourceUID)) {
        const [reduceExpression, _thresholdExpression] = getDefaultExpressions(getNextRefIdChar(queries), '-');
        queries.push(reduceExpression);
        const [_reduceExpression, thresholdExpression] = getDefaultExpressions(reduceExpression.refId, getNextRefIdChar(queries));
        queries.push(thresholdExpression);
    }
    const { folderTitle, folderUid } = dashboard.meta;
    const formValues = {
        type: RuleFormType.grafana,
        folder: folderUid && folderTitle
            ? {
                uid: folderUid,
                title: folderTitle,
            }
            : undefined,
        queries,
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
    return formValues;
});
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
export function fixBothInstantAndRangeQuery(query) {
    const model = query.model;
    if (!isPromQuery(model)) {
        return query;
    }
    const isBothInstantAndRange = model.instant && model.range;
    if (isBothInstantAndRange) {
        return Object.assign(Object.assign({}, query), { model: Object.assign(Object.assign({}, model), { range: true, instant: false }) });
    }
    return query;
}
function isPromQuery(model) {
    return 'expr' in model && 'instant' in model && 'range' in model;
}
export function isPromOrLokiQuery(model) {
    return 'expr' in model;
}
// the backend will always execute "hidden" queries, so we have no choice but to remove the property in the front-end
// to avoid confusion. The query editor shows them as "disabled" and that's a different semantic meaning.
// furthermore the "AlertingQueryRunner" calls `filterQuery` on each data source and those will skip running queries that are "hidden"."
// It seems like we have no choice but to act like "hidden" queries don't exist in alerting.
export const ignoreHiddenQueries = (ruleDefinition) => {
    var _a;
    return Object.assign(Object.assign({}, ruleDefinition), { queries: (_a = ruleDefinition.queries) === null || _a === void 0 ? void 0 : _a.map((query) => omit(query, 'model.hide')) });
};
export function formValuesFromExistingRule(rule) {
    return ignoreHiddenQueries(rulerRuleToFormValues(rule));
}
//# sourceMappingURL=rule-form.js.map