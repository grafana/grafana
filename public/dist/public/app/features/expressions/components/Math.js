import { css } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { Icon, InlineField, InlineLabel, TextArea, Toggletip, useStyles2 } from '@grafana/ui';
const mathPlaceholder = 'Math operations on one or more queries. You reference the query by ${refId} ie. $A, $B, $C etc\n' +
    'The sum of two scalar values: $A + $B > 10';
export const Math = ({ labelWidth, onChange, query, onRunQuery }) => {
    const onExpressionChange = (event) => {
        onChange(Object.assign(Object.assign({}, query), { expression: event.target.value }));
    };
    const styles = useStyles2(getStyles);
    const executeQuery = () => {
        if (query.expression) {
            onRunQuery();
        }
    };
    return (React.createElement(Stack, { direction: "row" },
        React.createElement(InlineField, { label: React.createElement(InlineLabel, { width: "auto" },
                React.createElement(Toggletip, { fitContent: true, content: React.createElement("div", { className: styles.documentationContainer },
                        React.createElement("div", null,
                            "Run math operations on one or more queries. You reference the query by ",
                            '${refId}',
                            " ie. $A, $B, $C etc.",
                            React.createElement("br", null),
                            "Example: ",
                            React.createElement("code", null, "$A + $B")),
                        React.createElement("header", { className: styles.documentationHeader }, "Available Math functions"),
                        React.createElement("div", { className: styles.documentationFunctions },
                            React.createElement(DocumentedFunction, { name: "abs", description: "returns the absolute value of its argument which can be a number or a series" }),
                            React.createElement(DocumentedFunction, { name: "is_inf", description: "returns 1 for Inf values (negative or positive) and 0 for other values. It's able to operate on series or scalar values." }),
                            React.createElement(DocumentedFunction, { name: "is_nan", description: "returns 1 for NaN values and 0 for other values. It's able to operate on series or scalar values." }),
                            React.createElement(DocumentedFunction, { name: "is_null", description: "returns 1 for null values and 0 for other values. It's able to operate on series or scalar values." }),
                            React.createElement(DocumentedFunction, { name: "is_number", description: "returns 1 for all real number values and 0 for non-number. It's able to operate on series or scalar values." }),
                            React.createElement(DocumentedFunction, { name: "log", description: "returns the natural logarithm of its argument, which can be a number or a series" }),
                            React.createElement(DocumentedFunction, { name: "inf, infn, nan, and null", description: "The inf for infinity positive, infn for infinity negative, nan, and null functions all return a single scalar value that matches its name." }),
                            React.createElement(DocumentedFunction, { name: "round", description: "returns a rounded integer value. It's able to operate on series or escalar values." }),
                            React.createElement(DocumentedFunction, { name: "ceil", description: "rounds the number up to the nearest integer value. It's able to operate on series or escalar values." }),
                            React.createElement(DocumentedFunction, { name: "floor", description: "rounds the number down to the nearest integer value. It's able to operate on series or escalar values." }))), title: React.createElement(Stack, { gap: 1, direction: "row" },
                        React.createElement(Icon, { name: "book-open" }),
                        " Math operator"), footer: React.createElement("div", null,
                        "See our additional documentation on",
                        ' ',
                        React.createElement("a", { className: styles.documentationLink, target: "_blank", href: "https://grafana.com/docs/grafana/latest/panels/query-a-data-source/use-expressions-to-manipulate-data/about-expressions/#math", rel: "noreferrer" },
                            React.createElement(Icon, { size: "xs", name: "external-link-alt" }),
                            " Math expressions"),
                        "."), closeButton: true, placement: "bottom-start" },
                    React.createElement("div", { className: styles.info },
                        "Expression ",
                        React.createElement(Icon, { name: "info-circle" })))), labelWidth: labelWidth, grow: true, shrink: true },
            React.createElement(TextArea, { value: query.expression, onChange: onExpressionChange, rows: 1, placeholder: mathPlaceholder, onBlur: executeQuery, style: { minWidth: 250, lineHeight: '26px', minHeight: 32 } }))));
};
const DocumentedFunction = ({ name, description }) => {
    const styles = useStyles2(getDocumentedFunctionStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("span", { className: styles.name }, name),
        React.createElement("span", { className: styles.description }, description)));
};
const getStyles = (theme) => ({
    documentationHeader: css `
    font-size: ${theme.typography.h5.fontSize};
    font-weight: ${theme.typography.h5.fontWeight};
  `,
    documentationLink: css `
    color: ${theme.colors.text.link};
  `,
    documentationContainer: css `
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: ${theme.spacing(2)};

    padding: ${theme.spacing(1)} ${theme.spacing(2)};
  `,
    documentationFunctions: css `
    display: grid;
    grid-template-columns: max-content auto;
    column-gap: ${theme.spacing(2)};
  `,
    info: css `
    display: flex;
    flex-direction: row;
    align-items: center;
    cursor: pointer;
    gap: ${theme.spacing(1)};
  `,
});
const getDocumentedFunctionStyles = (theme) => ({
    name: css `
    font-weight: ${theme.typography.fontWeightBold};
  `,
    description: css `
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.disabled};
  `,
});
//# sourceMappingURL=Math.js.map