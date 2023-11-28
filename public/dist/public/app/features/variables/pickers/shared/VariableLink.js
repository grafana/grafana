import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { ALL_VARIABLE_TEXT } from '../../constants';
export const VariableLink = ({ loading, disabled, onClick: propsOnClick, text, onCancel, id }) => {
    const styles = useStyles2(getStyles);
    const onClick = useCallback((event) => {
        event.stopPropagation();
        event.preventDefault();
        propsOnClick();
    }, [propsOnClick]);
    if (loading) {
        return (React.createElement("div", { className: styles.container, "data-testid": selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(`${text}`), title: text, id: id },
            React.createElement(VariableLinkText, { text: text }),
            React.createElement(LoadingIndicator, { onCancel: onCancel })));
    }
    return (React.createElement("button", { onClick: onClick, className: styles.container, "data-testid": selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(`${text}`), "aria-expanded": false, "aria-controls": `options-${id}`, id: id, title: text, disabled: disabled },
        React.createElement(VariableLinkText, { text: text }),
        React.createElement(Icon, { "aria-hidden": true, name: "angle-down", size: "sm" })));
};
const VariableLinkText = ({ text }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("span", { className: styles.textAndTags }, text === ALL_VARIABLE_TEXT ? t('variable.picker.link-all', 'All') : text));
};
const LoadingIndicator = ({ onCancel }) => {
    const onClick = useCallback((event) => {
        event.preventDefault();
        onCancel();
    }, [onCancel]);
    return (React.createElement(Tooltip, { content: "Cancel query" },
        React.createElement(Icon, { className: "spin-clockwise", name: "sync", size: "sm", onClick: onClick, "aria-label": selectors.components.LoadingIndicator.icon })));
};
const getStyles = (theme) => ({
    container: css `
    max-width: 500px;
    padding-right: 10px;
    padding: 0 ${theme.spacing(1)};
    background-color: ${theme.components.input.background};
    border: 1px solid ${theme.components.input.borderColor};
    border-radius: ${theme.shape.radius.default};
    display: flex;
    align-items: center;
    color: ${theme.colors.text};
    height: ${theme.spacing(theme.components.height.md)};

    .label-tag {
      margin: 0 5px;
    }

    &:disabled {
      background-color: ${theme.colors.action.disabledBackground};
      color: ${theme.colors.action.disabledText};
      border: 1px solid ${theme.colors.action.disabledBackground};
    }
  `,
    textAndTags: css `
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: ${theme.spacing(0.25)};
    user-select: none;
  `,
});
//# sourceMappingURL=VariableLink.js.map