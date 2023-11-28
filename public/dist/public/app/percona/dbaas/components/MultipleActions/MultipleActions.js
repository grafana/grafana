/* eslint-disable react/display-name */
import React, { Fragment } from 'react';
import { IconButton, Tooltip, useTheme } from '@grafana/ui';
import { Dropdown } from 'app/percona/shared/components/Elements/Dropdown';
import { getStyles } from './MultipleActions.styles';
export const MultipleActions = ({ actions, disabled, dataTestId, }) => {
    const theme = useTheme();
    const styles = getStyles(theme);
    const Toggle = React.forwardRef((props, ref) => (React.createElement(Tooltip, { content: "Actions", placement: "top" },
        React.createElement("span", { className: styles.iconWrapper },
            React.createElement(IconButton, Object.assign({ name: "ellipsis-v", "aria-label": "Toggle", size: "xl", disabled: disabled, "data-testid": dataTestId, ref: ref, className: styles.icon }, props))))));
    return (React.createElement(Dropdown, { toggle: Toggle, "data-testid": "multiple-actions-dropdown" }, actions.map(({ content, action, disabled }, index) => (React.createElement(Fragment, { key: index }, disabled ? (React.createElement("span", { className: styles.disabledButton, "data-testid": "disabled-dropdown-button" }, content)) : (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    React.createElement("span", { onClick: action, "data-testid": "dropdown-button" }, content)))))));
};
//# sourceMappingURL=MultipleActions.js.map