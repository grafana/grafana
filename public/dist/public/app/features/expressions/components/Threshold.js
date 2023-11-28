import { css } from '@emotion/css';
import React from 'react';
import { ButtonSelect, InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { thresholdFunctions } from '../types';
const defaultThresholdFunction = EvalFunction.IsAbove;
export const Threshold = ({ labelWidth, onChange, refIds, query }) => {
    var _a;
    const styles = useStyles2(getStyles);
    const defaultEvaluator = {
        type: 'query',
        evaluator: {
            type: defaultThresholdFunction,
            params: [0, 0],
        },
        query: {
            params: [],
        },
        reducer: {
            params: [],
            type: 'last',
        },
    };
    const conditions = ((_a = query.conditions) === null || _a === void 0 ? void 0 : _a.length) ? query.conditions : [defaultEvaluator];
    const condition = conditions[0];
    const thresholdFunction = thresholdFunctions.find((fn) => { var _a; return fn.value === ((_a = conditions[0].evaluator) === null || _a === void 0 ? void 0 : _a.type); });
    const onRefIdChange = (value) => {
        onChange(Object.assign(Object.assign({}, query), { expression: value.value }));
    };
    const onEvalFunctionChange = (value) => {
        var _a;
        const type = (_a = value.value) !== null && _a !== void 0 ? _a : defaultThresholdFunction;
        onChange(Object.assign(Object.assign({}, query), { conditions: updateConditions(conditions, { type }) }));
    };
    const onEvaluateValueChange = (event, index) => {
        const newValue = parseFloat(event.currentTarget.value);
        const newParams = [...condition.evaluator.params];
        newParams[index] = newValue;
        onChange(Object.assign(Object.assign({}, query), { conditions: updateConditions(conditions, { params: newParams }) }));
    };
    const isRange = condition.evaluator.type === EvalFunction.IsWithinRange || condition.evaluator.type === EvalFunction.IsOutsideRange;
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Input", labelWidth: labelWidth },
                React.createElement(Select, { onChange: onRefIdChange, options: refIds, value: query.expression, width: 20 }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(ButtonSelect, { className: styles.buttonSelectText, options: thresholdFunctions, onChange: onEvalFunctionChange, value: thresholdFunction }),
            isRange ? (React.createElement(React.Fragment, null,
                React.createElement(Input, { type: "number", width: 10, onChange: (event) => onEvaluateValueChange(event, 0), defaultValue: condition.evaluator.params[0] }),
                React.createElement("div", { className: styles.button }, "TO"),
                React.createElement(Input, { type: "number", width: 10, onChange: (event) => onEvaluateValueChange(event, 1), defaultValue: condition.evaluator.params[1] }))) : (React.createElement(Input, { type: "number", width: 10, onChange: (event) => onEvaluateValueChange(event, 0), defaultValue: conditions[0].evaluator.params[0] || 0 })))));
};
function updateConditions(conditions, update) {
    return [
        Object.assign(Object.assign({}, conditions[0]), { evaluator: Object.assign(Object.assign({}, conditions[0].evaluator), update) }),
    ];
}
const getStyles = (theme) => ({
    buttonSelectText: css `
    color: ${theme.colors.primary.text};
    font-size: ${theme.typography.bodySmall.fontSize};
    text-transform: uppercase;
  `,
    button: css `
    height: 32px;

    color: ${theme.colors.primary.text};
    font-size: ${theme.typography.bodySmall.fontSize};
    text-transform: uppercase;

    display: flex;
    align-items: center;
    border-radius: ${theme.shape.radius.default};
    font-weight: ${theme.typography.fontWeightBold};
    border: 1px solid ${theme.colors.border.medium};
    white-space: nowrap;
    padding: 0 ${theme.spacing(1)};
    background-color: ${theme.colors.background.primary};
  `,
});
//# sourceMappingURL=Threshold.js.map