import { css } from '@emotion/css';
import React from 'react';
import { Badge, clearButtonStyles, useStyles2 } from '@grafana/ui';
export const ExpressionStatusIndicator = ({ error, warning, isCondition, onSetCondition }) => {
    const styles = useStyles2(getStyles);
    const elements = [];
    if (error && isCondition) {
        return React.createElement(Badge, { color: "red", icon: "exclamation-circle", text: "Alert condition", tooltip: error.message });
    }
    else if (error) {
        elements.push(React.createElement(Badge, { key: "error", color: "red", icon: "exclamation-circle", text: "Error", tooltip: error.message }));
    }
    if (warning && isCondition) {
        return React.createElement(Badge, { color: "orange", icon: "exclamation-triangle", text: "Alert condition", tooltip: warning.message });
    }
    else if (warning) {
        elements.push(React.createElement(Badge, { key: "warning", color: "orange", icon: "exclamation-triangle", text: "Warning", tooltip: warning.message }));
    }
    if (isCondition) {
        elements.unshift(React.createElement(Badge, { key: "condition", color: "green", icon: "check", text: "Alert condition" }));
    }
    else {
        elements.unshift(React.createElement("button", { key: "make-condition", type: "button", className: styles.actionLink, onClick: () => onSetCondition && onSetCondition() }, "Set as alert condition"));
    }
    return React.createElement(React.Fragment, null, elements);
};
const getStyles = (theme) => {
    const clearButton = clearButtonStyles(theme);
    return {
        actionLink: css `
      ${clearButton};
      color: ${theme.colors.text.link};
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    `,
    };
};
//# sourceMappingURL=ExpressionStatusIndicator.js.map