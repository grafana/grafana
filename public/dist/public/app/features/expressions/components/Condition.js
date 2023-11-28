import { css, cx } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { Button, ButtonSelect, Icon, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';
import alertDef, { EvalFunction } from '../../alerting/state/alertDef';
const reducerFunctions = alertDef.reducerTypes.map((rt) => ({ label: rt.text, value: rt.value }));
const evalOperators = alertDef.evalOperators.map((eo) => ({ label: eo.text, value: eo.value }));
const evalFunctions = alertDef.evalFunctions.map((ef) => ({ label: ef.text, value: ef.value }));
export const Condition = ({ condition, index, onChange, onRemoveCondition, refIds }) => {
    const styles = useStyles2(getStyles);
    const onEvalOperatorChange = (evalOperator) => {
        onChange(Object.assign(Object.assign({}, condition), { operator: { type: evalOperator.value } }));
    };
    const onReducerFunctionChange = (conditionFunction) => {
        onChange(Object.assign(Object.assign({}, condition), { reducer: { type: conditionFunction.value, params: [] } }));
    };
    const onRefIdChange = (refId) => {
        onChange(Object.assign(Object.assign({}, condition), { query: { params: [refId.value] } }));
    };
    const onEvalFunctionChange = (evalFunction) => {
        onChange(Object.assign(Object.assign({}, condition), { evaluator: { params: condition.evaluator.params, type: evalFunction.value } }));
    };
    const onEvaluateValueChange = (event, index) => {
        const newValue = parseFloat(event.currentTarget.value);
        const newParams = [...condition.evaluator.params];
        newParams[index] = newValue;
        onChange(Object.assign(Object.assign({}, condition), { evaluator: Object.assign(Object.assign({}, condition.evaluator), { params: newParams }) }));
    };
    const buttonWidth = css `
    width: 60px;
  `;
    const isRange = condition.evaluator.type === EvalFunction.IsWithinRange || condition.evaluator.type === EvalFunction.IsOutsideRange;
    return (React.createElement(Stack, { direction: "row" },
        React.createElement("div", { style: { flex: 1 } },
            React.createElement(InlineFieldRow, null,
                index === 0 ? (React.createElement("div", { className: cx(styles.button, buttonWidth) }, "WHEN")) : (React.createElement(ButtonSelect, { className: cx(styles.buttonSelectText, buttonWidth), options: evalOperators, onChange: onEvalOperatorChange, value: evalOperators.find((ea) => ea.value === condition.operator.type) })),
                React.createElement(Select, { options: reducerFunctions, onChange: onReducerFunctionChange, width: 20, value: reducerFunctions.find((rf) => rf.value === condition.reducer.type) }),
                React.createElement("div", { className: styles.button }, "OF"),
                React.createElement(Select, { onChange: onRefIdChange, options: refIds, width: 'auto', value: refIds.find((r) => r.value === condition.query.params[0]) })),
            React.createElement(InlineFieldRow, null,
                React.createElement(ButtonSelect, { className: styles.buttonSelectText, options: evalFunctions, onChange: onEvalFunctionChange, value: evalFunctions.find((ef) => ef.value === condition.evaluator.type) }),
                isRange ? (React.createElement(React.Fragment, null,
                    React.createElement(Input, { type: "number", width: 10, onChange: (event) => onEvaluateValueChange(event, 0), value: condition.evaluator.params[0] }),
                    React.createElement("div", { className: styles.button }, "TO"),
                    React.createElement(Input, { type: "number", width: 10, onChange: (event) => onEvaluateValueChange(event, 1), value: condition.evaluator.params[1] }))) : condition.evaluator.type !== EvalFunction.HasNoValue ? (React.createElement(Input, { type: "number", width: 10, onChange: (event) => onEvaluateValueChange(event, 0), value: condition.evaluator.params[0] })) : null)),
        React.createElement(Button, { variant: "secondary", type: "button", onClick: () => onRemoveCondition(index) },
            React.createElement(Icon, { name: "trash-alt" }))));
};
const getStyles = (theme) => {
    const buttonStyle = css `
    color: ${theme.colors.primary.text};
    font-size: ${theme.typography.bodySmall.fontSize};
  `;
    return {
        buttonSelectText: buttonStyle,
        button: cx(css `
        display: flex;
        align-items: center;
        border-radius: ${theme.shape.radius.default};
        font-weight: ${theme.typography.fontWeightMedium};
        border: 1px solid ${theme.colors.border.weak};
        white-space: nowrap;
        padding: 0 ${theme.spacing(1)};
        background-color: ${theme.colors.background.canvas};
      `, buttonStyle),
    };
};
//# sourceMappingURL=Condition.js.map