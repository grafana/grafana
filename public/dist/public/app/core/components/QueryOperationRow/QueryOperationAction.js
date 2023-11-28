import { css, cx } from '@emotion/css';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { IconButton, useStyles2 } from '@grafana/ui';
function BaseQueryOperationAction(props) {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: cx(styles.icon, 'active' in props && props.active && styles.active) },
        React.createElement(IconButton, Object.assign({ name: props.icon, tooltip: props.title, className: styles.icon, disabled: !!props.disabled, onClick: props.onClick, type: "button", "aria-label": selectors.components.QueryEditorRow.actionButton(props.title) }, ('active' in props && { 'aria-pressed': props.active })))));
}
export function QueryOperationAction(props) {
    return React.createElement(BaseQueryOperationAction, Object.assign({}, props));
}
export const QueryOperationToggleAction = (props) => {
    return React.createElement(BaseQueryOperationAction, Object.assign({}, props));
};
const getStyles = (theme) => {
    return {
        icon: css `
      display: flex;
      position: relative;
      color: ${theme.colors.text.secondary};
    `,
        active: css `
      &::before {
        display: block;
        content: ' ';
        position: absolute;
        left: -1px;
        right: 2px;
        height: 3px;
        border-radius: ${theme.shape.radius.default};
        bottom: -8px;
        background-image: ${theme.colors.gradients.brandHorizontal} !important;
      }
    `,
    };
};
//# sourceMappingURL=QueryOperationAction.js.map