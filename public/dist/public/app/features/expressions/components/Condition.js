import { __assign, __makeTemplateObject, __read, __spreadArray } from "tslib";
import React from 'react';
import { css, cx } from '@emotion/css';
import { Button, ButtonSelect, Icon, InlineFieldRow, Input, Select, useStyles } from '@grafana/ui';
import alertDef, { EvalFunction } from '../../alerting/state/alertDef';
var reducerFunctions = alertDef.reducerTypes.map(function (rt) { return ({ label: rt.text, value: rt.value }); });
var evalOperators = alertDef.evalOperators.map(function (eo) { return ({ label: eo.text, value: eo.value }); });
var evalFunctions = alertDef.evalFunctions.map(function (ef) { return ({ label: ef.text, value: ef.value }); });
export var Condition = function (_a) {
    var condition = _a.condition, index = _a.index, onChange = _a.onChange, onRemoveCondition = _a.onRemoveCondition, refIds = _a.refIds;
    var styles = useStyles(getStyles);
    var onEvalOperatorChange = function (evalOperator) {
        onChange(__assign(__assign({}, condition), { operator: { type: evalOperator.value } }));
    };
    var onReducerFunctionChange = function (conditionFunction) {
        onChange(__assign(__assign({}, condition), { reducer: { type: conditionFunction.value, params: [] } }));
    };
    var onRefIdChange = function (refId) {
        onChange(__assign(__assign({}, condition), { query: { params: [refId.value] } }));
    };
    var onEvalFunctionChange = function (evalFunction) {
        onChange(__assign(__assign({}, condition), { evaluator: { params: condition.evaluator.params, type: evalFunction.value } }));
    };
    var onEvaluateValueChange = function (event, index) {
        var newValue = parseFloat(event.currentTarget.value);
        var newParams = __spreadArray([], __read(condition.evaluator.params), false);
        newParams[index] = newValue;
        onChange(__assign(__assign({}, condition), { evaluator: __assign(__assign({}, condition.evaluator), { params: newParams }) }));
    };
    var buttonWidth = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 60px;\n  "], ["\n    width: 60px;\n  "])));
    var isRange = condition.evaluator.type === EvalFunction.IsWithinRange || condition.evaluator.type === EvalFunction.IsOutsideRange;
    return (React.createElement(InlineFieldRow, null,
        index === 0 ? (React.createElement("div", { className: cx(styles.button, buttonWidth) }, "WHEN")) : (React.createElement(ButtonSelect, { className: cx(styles.buttonSelectText, buttonWidth), options: evalOperators, onChange: onEvalOperatorChange, value: evalOperators.find(function (ea) { return ea.value === condition.operator.type; }) })),
        React.createElement(Select, { menuShouldPortal: true, options: reducerFunctions, onChange: onReducerFunctionChange, width: 20, value: reducerFunctions.find(function (rf) { return rf.value === condition.reducer.type; }) }),
        React.createElement("div", { className: styles.button }, "OF"),
        React.createElement(Select, { menuShouldPortal: true, onChange: onRefIdChange, options: refIds, width: 15, value: refIds.find(function (r) { return r.value === condition.query.params[0]; }) }),
        React.createElement(ButtonSelect, { className: styles.buttonSelectText, options: evalFunctions, onChange: onEvalFunctionChange, value: evalFunctions.find(function (ef) { return ef.value === condition.evaluator.type; }) }),
        isRange ? (React.createElement(React.Fragment, null,
            React.createElement(Input, { type: "number", width: 10, onChange: function (event) { return onEvaluateValueChange(event, 0); }, value: condition.evaluator.params[0] }),
            React.createElement("div", { className: styles.button }, "TO"),
            React.createElement(Input, { type: "number", width: 10, onChange: function (event) { return onEvaluateValueChange(event, 1); }, value: condition.evaluator.params[1] }))) : condition.evaluator.type !== EvalFunction.HasNoValue ? (React.createElement(Input, { type: "number", width: 10, onChange: function (event) { return onEvaluateValueChange(event, 0); }, value: condition.evaluator.params[0] })) : null,
        React.createElement(Button, { variant: "secondary", type: "button", onClick: function () { return onRemoveCondition(index); } },
            React.createElement(Icon, { name: "trash-alt" }))));
};
var getStyles = function (theme) {
    var buttonStyle = css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    color: ", ";\n    font-size: ", ";\n  "], ["\n    color: ", ";\n    font-size: ", ";\n  "])), theme.colors.textBlue, theme.typography.size.sm);
    return {
        buttonSelectText: buttonStyle,
        button: cx(css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        display: flex;\n        align-items: center;\n        border-radius: ", ";\n        font-weight: ", ";\n        border: 1px solid ", ";\n        white-space: nowrap;\n        padding: 0 ", ";\n        background-color: ", ";\n      "], ["\n        display: flex;\n        align-items: center;\n        border-radius: ", ";\n        font-weight: ", ";\n        border: 1px solid ", ";\n        white-space: nowrap;\n        padding: 0 ", ";\n        background-color: ", ";\n      "])), theme.border.radius.sm, theme.typography.weight.semibold, theme.colors.border1, theme.spacing.sm, theme.colors.bodyBg), buttonStyle),
    };
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=Condition.js.map