import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import { dump } from 'js-yaml';
import { keyBy, startCase } from 'lodash';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Badge, useStyles2 } from '@grafana/ui';
import { mapRelativeTimeRangeToOption } from '@grafana/ui/src/components/DateTimePickers/RelativeTimeRangePicker/utils';
import { isExpressionQuery } from '../../expressions/guards';
import { downsamplingTypes, ExpressionQueryType, reducerModes, ReducerMode, reducerTypes, thresholdFunctions, upsamplingTypes, } from '../../expressions/types';
import alertDef, { EvalFunction } from '../state/alertDef';
import { ExpressionResult } from './components/expressions/Expression';
import { getThresholdsForQueries } from './components/rule-editor/util';
import { RuleViewerVisualization } from './components/rule-viewer/RuleViewerVisualization';
export function GrafanaRuleQueryViewer({ queries, condition, evalDataByQuery = {}, evalTimeRanges = {}, onTimeRangeChange, }) {
    const dsByUid = keyBy(Object.values(config.datasources), (ds) => ds.uid);
    const dataQueries = queries.filter((q) => !isExpressionQuery(q.model));
    const expressions = queries.filter((q) => isExpressionQuery(q.model));
    const styles = useStyles2(getExpressionViewerStyles);
    const thresholds = getThresholdsForQueries(queries);
    return (React.createElement(Stack, { gap: 2, direction: "column" },
        React.createElement("div", { className: styles.maxWidthContainer },
            React.createElement(Stack, { gap: 2 }, dataQueries.map(({ model, relativeTimeRange, refId, datasourceUid }, index) => {
                const dataSource = dsByUid[datasourceUid];
                return (React.createElement(QueryPreview, { key: index, refId: refId, isAlertCondition: condition === refId, model: model, relativeTimeRange: relativeTimeRange, evalTimeRange: evalTimeRanges[refId], dataSource: dataSource, thresholds: thresholds[refId], queryData: evalDataByQuery[refId], onEvalTimeRangeChange: (timeRange) => onTimeRangeChange(refId, timeRange) }));
            }))),
        React.createElement("div", { className: styles.maxWidthContainer },
            React.createElement(Stack, { gap: 1 }, expressions.map(({ model, refId, datasourceUid }, index) => {
                const dataSource = dsByUid[datasourceUid];
                return (isExpressionQuery(model) && (React.createElement(ExpressionPreview, { key: index, refId: refId, isAlertCondition: condition === refId, model: model, dataSource: dataSource, evalData: evalDataByQuery[refId] })));
            })))));
}
export function QueryPreview({ refId, relativeTimeRange, thresholds, model, dataSource, queryData, evalTimeRange, onEvalTimeRangeChange, }) {
    var _a;
    const styles = useStyles2(getQueryPreviewStyles);
    // relativeTimeRange is what is defined for a query
    // evalTimeRange is temporary value which the user can change
    const headerItems = [(_a = dataSource === null || dataSource === void 0 ? void 0 : dataSource.name) !== null && _a !== void 0 ? _a : '[[Data source not found]]'];
    if (relativeTimeRange) {
        headerItems.push(mapRelativeTimeRangeToOption(relativeTimeRange).display);
    }
    return (React.createElement(QueryBox, { refId: refId, headerItems: headerItems, className: styles.contentBox },
        React.createElement("pre", { className: styles.code },
            React.createElement("code", null, dump(model))),
        dataSource && (React.createElement(RuleViewerVisualization, { refId: refId, dsSettings: dataSource, model: model, data: queryData, thresholds: thresholds, relativeTimeRange: evalTimeRange, onTimeRangeChange: onEvalTimeRangeChange, className: styles.visualization }))));
}
const getQueryPreviewStyles = (theme) => ({
    code: css `
    margin: ${theme.spacing(1)};
  `,
    contentBox: css `
    flex: 1 0 100%;
  `,
    visualization: css `
    padding: ${theme.spacing(1)};
  `,
});
function ExpressionPreview({ refId, model, evalData, isAlertCondition }) {
    function renderPreview() {
        switch (model.type) {
            case ExpressionQueryType.math:
                return React.createElement(MathExpressionViewer, { model: model });
            case ExpressionQueryType.reduce:
                return React.createElement(ReduceConditionViewer, { model: model });
            case ExpressionQueryType.resample:
                return React.createElement(ResampleExpressionViewer, { model: model });
            case ExpressionQueryType.classic:
                return React.createElement(ClassicConditionViewer, { model: model });
            case ExpressionQueryType.threshold:
                return React.createElement(ThresholdExpressionViewer, { model: model });
            default:
                return React.createElement(React.Fragment, null,
                    "Expression not supported: ",
                    model.type);
        }
    }
    return (React.createElement(QueryBox, { refId: refId, headerItems: [startCase(model.type)], isAlertCondition: isAlertCondition },
        renderPreview(),
        evalData && React.createElement(ExpressionResult, { series: evalData.series, isAlertCondition: isAlertCondition })));
}
function QueryBox({ refId, headerItems = [], children, isAlertCondition, className }) {
    const styles = useStyles2(getQueryBoxStyles);
    return (React.createElement("div", { className: cx(styles.container, className) },
        React.createElement("header", { className: styles.header },
            React.createElement("span", { className: styles.refId }, refId),
            headerItems.map((item, index) => (React.createElement("span", { key: index, className: styles.textBlock }, item))),
            isAlertCondition && (React.createElement("div", { className: styles.conditionIndicator },
                React.createElement(Badge, { color: "green", icon: "check", text: "Alert condition" })))),
        children));
}
const getQueryBoxStyles = (theme) => ({
    container: css `
    flex: 1 0 25%;
    border: 1px solid ${theme.colors.border.strong};
    max-width: 100%;
  `,
    header: css `
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    padding: ${theme.spacing(1)};
    background-color: ${theme.colors.background.secondary};
  `,
    textBlock: css `
    border: 1px solid ${theme.colors.border.weak};
    padding: ${theme.spacing(0.5, 1)};
    background-color: ${theme.colors.background.primary};
  `,
    refId: css `
    color: ${theme.colors.text.link};
    padding: ${theme.spacing(0.5, 1)};
    border: 1px solid ${theme.colors.border.weak};
  `,
    conditionIndicator: css `
    margin-left: auto;
  `,
});
function ClassicConditionViewer({ model }) {
    var _a;
    const styles = useStyles2(getClassicConditionViewerStyles);
    const reducerFunctions = keyBy(alertDef.reducerTypes, (rt) => rt.value);
    const evalOperators = keyBy(alertDef.evalOperators, (eo) => eo.value);
    const evalFunctions = keyBy(alertDef.evalFunctions, (ef) => ef.value);
    return (React.createElement("div", { className: styles.container }, (_a = model.conditions) === null || _a === void 0 ? void 0 : _a.map(({ query, operator, reducer, evaluator }, index) => {
        var _a, _b;
        const isRange = isRangeEvaluator(evaluator);
        return (React.createElement(React.Fragment, { key: index },
            React.createElement("div", { className: styles.blue }, index === 0 ? 'WHEN' : !!(operator === null || operator === void 0 ? void 0 : operator.type) && ((_a = evalOperators[operator === null || operator === void 0 ? void 0 : operator.type]) === null || _a === void 0 ? void 0 : _a.text)),
            React.createElement("div", { className: styles.bold }, (reducer === null || reducer === void 0 ? void 0 : reducer.type) && ((_b = reducerFunctions[reducer.type]) === null || _b === void 0 ? void 0 : _b.text)),
            React.createElement("div", { className: styles.blue }, "OF"),
            React.createElement("div", { className: styles.bold }, query.params[0]),
            React.createElement("div", { className: styles.blue }, evalFunctions[evaluator.type].text),
            React.createElement("div", { className: styles.bold }, isRange ? `(${evaluator.params[0]}; ${evaluator.params[1]})` : evaluator.params[0])));
    })));
}
const getClassicConditionViewerStyles = (theme) => (Object.assign({ container: css `
    padding: ${theme.spacing(1)};
    display: grid;
    grid-template-columns: max-content max-content max-content max-content max-content max-content;
    gap: ${theme.spacing(0, 1)};
  ` }, getCommonQueryStyles(theme)));
function ReduceConditionViewer({ model }) {
    var _a;
    const styles = useStyles2(getReduceConditionViewerStyles);
    const { reducer, expression, settings } = model;
    const reducerType = reducerTypes.find((rt) => rt.value === reducer);
    const reducerMode = (_a = settings === null || settings === void 0 ? void 0 : settings.mode) !== null && _a !== void 0 ? _a : ReducerMode.Strict;
    const modeName = reducerModes.find((rm) => rm.value === reducerMode);
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.label }, "Function"),
        React.createElement("div", { className: styles.value }, reducerType === null || reducerType === void 0 ? void 0 : reducerType.label),
        React.createElement("div", { className: styles.label }, "Input"),
        React.createElement("div", { className: styles.value }, expression),
        React.createElement("div", { className: styles.label }, "Mode"),
        React.createElement("div", { className: styles.value }, modeName === null || modeName === void 0 ? void 0 : modeName.label)));
}
const getReduceConditionViewerStyles = (theme) => (Object.assign({ container: css `
    padding: ${theme.spacing(1)};
    display: grid;
    gap: ${theme.spacing(1)};
    grid-template-rows: 1fr 1fr;
    grid-template-columns: 1fr 1fr 1fr 1fr;

    > :nth-child(6) {
      grid-column: span 3;
    }
  ` }, getCommonQueryStyles(theme)));
function ResampleExpressionViewer({ model }) {
    const styles = useStyles2(getResampleExpressionViewerStyles);
    const { expression, window, downsampler, upsampler } = model;
    const downsamplerType = downsamplingTypes.find((dt) => dt.value === downsampler);
    const upsamplerType = upsamplingTypes.find((ut) => ut.value === upsampler);
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.label }, "Input"),
        React.createElement("div", { className: styles.value }, expression),
        React.createElement("div", { className: styles.label }, "Resample to"),
        React.createElement("div", { className: styles.value }, window),
        React.createElement("div", { className: styles.label }, "Downsample"),
        React.createElement("div", { className: styles.value }, downsamplerType === null || downsamplerType === void 0 ? void 0 : downsamplerType.label),
        React.createElement("div", { className: styles.label }, "Upsample"),
        React.createElement("div", { className: styles.value }, upsamplerType === null || upsamplerType === void 0 ? void 0 : upsamplerType.label)));
}
const getResampleExpressionViewerStyles = (theme) => (Object.assign({ container: css `
    padding: ${theme.spacing(1)};
    display: grid;
    gap: ${theme.spacing(1)};
    grid-template-columns: 1fr 1fr 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  ` }, getCommonQueryStyles(theme)));
function ThresholdExpressionViewer({ model }) {
    var _a;
    const styles = useStyles2(getExpressionViewerStyles);
    const { expression, conditions } = model;
    const evaluator = conditions && ((_a = conditions[0]) === null || _a === void 0 ? void 0 : _a.evaluator);
    const thresholdFunction = thresholdFunctions.find((tf) => tf.value === (evaluator === null || evaluator === void 0 ? void 0 : evaluator.type));
    const isRange = evaluator ? isRangeEvaluator(evaluator) : false;
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.label }, "Input"),
        React.createElement("div", { className: styles.value }, expression),
        evaluator && (React.createElement(React.Fragment, null,
            React.createElement("div", { className: styles.blue }, thresholdFunction === null || thresholdFunction === void 0 ? void 0 : thresholdFunction.label),
            React.createElement("div", { className: styles.bold }, isRange ? `(${evaluator.params[0]}; ${evaluator.params[1]})` : evaluator.params[0])))));
}
const getExpressionViewerStyles = (theme) => {
    const _a = getCommonQueryStyles(theme), { blue, bold } = _a, common = __rest(_a, ["blue", "bold"]);
    return Object.assign(Object.assign({}, common), { maxWidthContainer: css `
      max-width: 100%;
    `, container: css `
      padding: ${theme.spacing(1)};
      display: flex;
      gap: ${theme.spacing(1)};
    `, blue: css `
      ${blue};
      margin: auto 0;
    `, bold: css `
      ${bold};
      margin: auto 0;
    ` });
};
function MathExpressionViewer({ model }) {
    const styles = useStyles2(getExpressionViewerStyles);
    const { expression } = model;
    return (React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.label }, "Input"),
        React.createElement("div", { className: styles.value }, expression)));
}
const getCommonQueryStyles = (theme) => ({
    blue: css `
    color: ${theme.colors.text.link};
  `,
    bold: css `
    font-weight: ${theme.typography.fontWeightBold};
  `,
    label: css `
    display: flex;
    align-items: center;
    padding: ${theme.spacing(0.5, 1)};
    background-color: ${theme.colors.background.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    line-height: ${theme.typography.bodySmall.lineHeight};
    font-weight: ${theme.typography.fontWeightBold};
  `,
    value: css `
    padding: ${theme.spacing(0.5, 1)};
    border: 1px solid ${theme.colors.border.weak};
  `,
});
function isRangeEvaluator(evaluator) {
    return evaluator.type === EvalFunction.IsWithinRange || evaluator.type === EvalFunction.IsOutsideRange;
}
//# sourceMappingURL=GrafanaRuleQueryViewer.js.map