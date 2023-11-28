import { xor } from 'lodash';
import { isTimeSeriesFrames, LoadingState, ThresholdsMode, } from '@grafana/data';
import { GraphTresholdsStyleMode } from '@grafana/schema';
import { config } from 'app/core/config';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQueryType } from 'app/features/expressions/types';
import { RuleFormType } from '../../types/rule-form';
import { createDagFromQueries, getOriginOfRefId } from './dag';
export function queriesWithUpdatedReferences(queries, previousRefId, newRefId) {
    return queries.map((query) => {
        var _a, _b;
        if (previousRefId === newRefId) {
            return query;
        }
        if (!isExpressionQuery(query.model)) {
            return query;
        }
        const isMathExpression = query.model.type === 'math';
        const isReduceExpression = query.model.type === 'reduce';
        const isResampleExpression = query.model.type === 'resample';
        const isClassicExpression = query.model.type === 'classic_conditions';
        const isThresholdExpression = query.model.type === 'threshold';
        if (isMathExpression) {
            return Object.assign(Object.assign({}, query), { model: Object.assign(Object.assign({}, query.model), { expression: updateMathExpressionRefs((_a = query.model.expression) !== null && _a !== void 0 ? _a : '', previousRefId, newRefId) }) });
        }
        if (isResampleExpression || isReduceExpression || isThresholdExpression) {
            const isReferencing = query.model.expression === previousRefId;
            return Object.assign(Object.assign({}, query), { model: Object.assign(Object.assign({}, query.model), { expression: isReferencing ? newRefId : query.model.expression }) });
        }
        if (isClassicExpression) {
            const conditions = (_b = query.model.conditions) === null || _b === void 0 ? void 0 : _b.map((condition) => (Object.assign(Object.assign({}, condition), { query: Object.assign(Object.assign({}, condition.query), { params: condition.query.params.map((param) => (param === previousRefId ? newRefId : param)) }) })));
            return Object.assign(Object.assign({}, query), { model: Object.assign(Object.assign({}, query.model), { conditions }) });
        }
        return query;
    });
}
export function updateMathExpressionRefs(expression, previousRefId, newRefId) {
    const oldExpression = new RegExp('(\\$' + previousRefId + '\\b)|(\\${' + previousRefId + '})', 'gm');
    const newExpression = '${' + newRefId + '}';
    return expression.replace(oldExpression, newExpression);
}
export function refIdExists(queries, refId) {
    return queries.find((query) => query.refId === refId) !== undefined;
}
// some gateways (like Istio) will decode "/" and "\" characters – this will cause 404 errors for any API call
// that includes these values in the URL (ie. /my/path%2fto/resource -> /my/path/to/resource)
//
// see https://istio.io/latest/docs/ops/best-practices/security/#customize-your-system-on-path-normalization
export function checkForPathSeparator(value) {
    const containsPathSeparator = value.includes('/') || value.includes('\\');
    if (containsPathSeparator) {
        return 'Cannot contain "/" or "\\" characters';
    }
    return true;
}
// this function assumes we've already checked if the data passed in to the function is of the alert condition
export function errorFromCurrentCondition(data) {
    if (data.series.length === 0) {
        return;
    }
    const isTimeSeriesResults = isTimeSeriesFrames(data.series);
    let error;
    if (isTimeSeriesResults) {
        error = new Error('You cannot use time series data as an alert condition, consider adding a reduce expression.');
    }
    return error;
}
export function errorFromPreviewData(data) {
    var _a;
    // give preference to QueryErrors
    if ((_a = data.errors) === null || _a === void 0 ? void 0 : _a.length) {
        return new Error(data.errors[0].message);
    }
    return;
}
export function warningFromSeries(series) {
    var _a, _b, _c, _d;
    const notices = (_c = (_b = (_a = series[0]) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.notices) !== null && _c !== void 0 ? _c : [];
    const warning = (_d = notices.find((notice) => notice.severity === 'warning')) === null || _d === void 0 ? void 0 : _d.text;
    return warning ? new Error(warning) : undefined;
}
/**
 * This function will retrieve threshold definitions for the given array of data and expression queries.
 */
export function getThresholdsForQueries(queries) {
    const thresholds = {};
    const SUPPORTED_EXPRESSION_TYPES = [ExpressionQueryType.threshold, ExpressionQueryType.classic];
    for (const query of queries) {
        if (!isExpressionQuery(query.model)) {
            continue;
        }
        // currently only supporting "threshold" & "classic_condition" expressions
        if (!SUPPORTED_EXPRESSION_TYPES.includes(query.model.type)) {
            continue;
        }
        if (!Array.isArray(query.model.conditions)) {
            continue;
        }
        // if any of the conditions are a "range" we switch to an "area" threshold view and ignore single threshold values
        // the time series panel does not support both.
        const hasRangeThreshold = query.model.conditions.some(isRangeCondition);
        query.model.conditions.forEach((condition) => {
            var _a, _b;
            const threshold = condition.evaluator.params;
            // "classic_conditions" use `condition.query.params[]` and "threshold" uses `query.model.expression`
            const refId = (_b = (_a = condition.query) === null || _a === void 0 ? void 0 : _a.params[0]) !== null && _b !== void 0 ? _b : query.model.expression;
            // if an expression hasn't been linked to a data query yet, it won't have a refId
            if (!refId) {
                return;
            }
            const isRangeThreshold = isRangeCondition(condition);
            try {
                // create a DAG so we can find the origin of the current expression
                const graph = createDagFromQueries(queries);
                const originRefIDs = getOriginOfRefId(refId, graph);
                const originQueries = queries.filter((query) => originRefIDs.includes(query.refId));
                originQueries.forEach((originQuery) => {
                    const originRefID = originQuery.refId;
                    // check if the origin is a data query
                    const originIsDataQuery = !isExpressionQuery(originQuery === null || originQuery === void 0 ? void 0 : originQuery.model);
                    // if yes, add threshold config to the refId of the data Query
                    const hasValidOrigin = Boolean(originIsDataQuery && originRefID);
                    // create the initial data structure for this origin refId
                    if (originRefID && !thresholds[originRefID]) {
                        thresholds[originRefID] = {
                            config: {
                                mode: ThresholdsMode.Absolute,
                                steps: [],
                            },
                            mode: GraphTresholdsStyleMode.Line,
                        };
                    }
                    if (originRefID && hasValidOrigin && !isRangeThreshold && !hasRangeThreshold) {
                        appendSingleThreshold(originRefID, threshold[0]);
                    }
                    else if (originRefID && hasValidOrigin && isRangeThreshold) {
                        appendRangeThreshold(originRefID, threshold, condition.evaluator.type);
                        thresholds[originRefID].mode = GraphTresholdsStyleMode.LineAndArea;
                    }
                });
            }
            catch (err) {
                console.error('Failed to parse thresholds', err);
                return;
            }
        });
    }
    function appendSingleThreshold(refId, value) {
        thresholds[refId].config.steps.push(...[
            {
                value: -Infinity,
                color: 'transparent',
            },
            {
                value: value,
                color: config.theme2.colors.error.main,
            },
        ]);
    }
    function appendRangeThreshold(refId, values, type) {
        if (type === EvalFunction.IsWithinRange) {
            thresholds[refId].config.steps.push(...[
                {
                    value: -Infinity,
                    color: 'transparent',
                },
                {
                    value: values[0],
                    color: config.theme2.colors.error.main,
                },
                {
                    value: values[1],
                    color: config.theme2.colors.error.main,
                },
                {
                    value: values[1],
                    color: 'transparent',
                },
            ]);
        }
        if (type === EvalFunction.IsOutsideRange) {
            thresholds[refId].config.steps.push(...[
                {
                    value: -Infinity,
                    color: config.theme2.colors.error.main,
                },
                // we have to duplicate this value, or the graph will not display the handle in the right color
                {
                    value: values[0],
                    color: config.theme2.colors.error.main,
                },
                {
                    value: values[0],
                    color: 'transparent',
                },
                {
                    value: values[1],
                    color: config.theme2.colors.error.main,
                },
            ]);
        }
        // now also sort the threshold values, if we don't then they will look weird in the time series panel
        // TODO this doesn't work for negative values for now, those need to be sorted inverse
        thresholds[refId].config.steps.sort((a, b) => a.value - b.value);
        // also make sure we remove any "undefined" values from our steps in case the threshold config is incomplete
        thresholds[refId].config.steps = thresholds[refId].config.steps.filter((step) => step.value !== undefined);
    }
    return thresholds;
}
function isRangeCondition(condition) {
    return (condition.evaluator.type === EvalFunction.IsWithinRange || condition.evaluator.type === EvalFunction.IsOutsideRange);
}
export function getStatusMessage(data) {
    var _a, _b;
    const genericErrorMessage = 'Failed to fetch data';
    if (data.state !== LoadingState.Error) {
        return;
    }
    const errors = data.errors;
    if (errors === null || errors === void 0 ? void 0 : errors.length) {
        return errors.map((error) => { var _a; return (_a = error.message) !== null && _a !== void 0 ? _a : genericErrorMessage; }).join(', ');
    }
    return (_b = (_a = data.error) === null || _a === void 0 ? void 0 : _a.message) !== null && _b !== void 0 ? _b : genericErrorMessage;
}
export function translateRouteParamToRuleType(param = '') {
    if (param === 'recording') {
        return RuleFormType.cloudRecording;
    }
    return RuleFormType.grafana;
}
/**
 * This function finds what refIds have been updated given the previous Array of queries and an Array of updated data queries.
 * All expression queries are discarded from the arrays, since we have separate handlers for those (see "onUpdateRefId") of the ExpressionEditor
 *
 * This code assumes not more than 1 query refId has changed per "onChangeQueries",
 */
export function findRenamedDataQueryReferences(previousQueries, updatedQueries) {
    const updatedDataQueries = updatedQueries
        .filter((query) => !isExpressionQuery(query.model))
        .map((query) => query.refId);
    const previousDataQueries = previousQueries
        .filter((query) => !isExpressionQuery(query.model))
        .map((query) => query.refId);
    // given the following two arrays
    // ['A', 'B', 'C'] and ['FOO', 'B' 'C']
    // the "xor" function will return ['A', 'FOO'] because those are not in both arrays
    const [oldRefId, newRefId] = xor(previousDataQueries, updatedDataQueries);
    return [oldRefId, newRefId];
}
//# sourceMappingURL=util.js.map