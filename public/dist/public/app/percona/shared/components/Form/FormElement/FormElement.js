import { css } from '@emotion/css';
import React from 'react';
const style = {
    verticalFieldLabelRow: css `
    padding-bottom: 5px;
  `,
    formElementWrapper: css `
    margin-bottom: 20px;
  `,
    fieldLabelColumn: css `
    display: flex;
    justify-content: flex-start;
    padding-right: 20px;
  `,
};
const getErrorsWrapperStyle = (align) => {
    let alignLabel;
    switch (align) {
        case 'top':
            alignLabel = 'flex-start';
            break;
        case 'middle':
            alignLabel = 'center';
            break;
        case 'bottom':
            alignLabel = 'flex-end';
            break;
        default:
            alignLabel = 'center';
    }
    return css `
    color: white;
    margin-bottom: 10px;
    display: flex;
    align-items: ${alignLabel};
  `;
};
const HorizontalFieldLayout = ({ label, tooltip, element, }) => (React.createElement(React.Fragment, null,
    React.createElement("div", null,
        React.createElement("div", { className: style.fieldLabelColumn },
            React.createElement("span", null, label),
            React.createElement("span", null, tooltip || '')),
        React.createElement("div", null, element))));
const VerticalFieldLayout = ({ label, tooltip, alignLabel, element, }) => (React.createElement(React.Fragment, null,
    React.createElement("div", { className: style.verticalFieldLabelRow },
        React.createElement("div", { className: style.fieldLabelColumn },
            React.createElement("span", null, label),
            React.createElement("span", null, tooltip || ''))),
    React.createElement("div", { className: getErrorsWrapperStyle(alignLabel) },
        React.createElement("div", null, element))));
export const FormElement = (props) => {
    const { dataTestId, type, errors, alignLabel } = props;
    return (React.createElement("div", { className: style.formElementWrapper, "data-testid": dataTestId },
        type === 'horizontal' ? React.createElement(HorizontalFieldLayout, Object.assign({}, props)) : React.createElement(VerticalFieldLayout, Object.assign({}, props)),
        React.createElement("div", { className: getErrorsWrapperStyle(alignLabel) },
            React.createElement("div", null, errors))));
};
//# sourceMappingURL=FormElement.js.map