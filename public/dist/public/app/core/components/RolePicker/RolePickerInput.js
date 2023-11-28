import { __rest } from "tslib";
import { css, cx } from '@emotion/css';
import React, { useEffect, useRef } from 'react';
import { useStyles2, getInputStyles, sharedInputStyle, styleMixins, Tooltip, Icon } from '@grafana/ui';
import { ValueContainer } from './ValueContainer';
import { ROLE_PICKER_WIDTH } from './constants';
const stopPropagation = (event) => event.stopPropagation();
export const RolePickerInput = (_a) => {
    var { appliedRoles, basicRole, disabled, isFocused, query, showBasicRole, onOpen, onClose, onQueryChange } = _a, rest = __rest(_a, ["appliedRoles", "basicRole", "disabled", "isFocused", "query", "showBasicRole", "onOpen", "onClose", "onQueryChange"]);
    const styles = useStyles2(getRolePickerInputStyles, false, !!isFocused, !!disabled, false);
    const inputRef = useRef(null);
    useEffect(() => {
        var _a;
        if (isFocused) {
            (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.focus();
        }
    });
    const onInputChange = (event) => {
        var _a;
        const query = (_a = event.target) === null || _a === void 0 ? void 0 : _a.value;
        onQueryChange(query);
    };
    const showBasicRoleOnLabel = showBasicRole && basicRole !== 'None';
    return !isFocused ? (
    // TODO: fix keyboard a11y
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    React.createElement("div", { className: cx(styles.wrapper, styles.selectedRoles), onMouseDown: onOpen },
        showBasicRoleOnLabel && React.createElement(ValueContainer, null, basicRole),
        React.createElement(RolesLabel, { appliedRoles: appliedRoles, numberOfRoles: appliedRoles.length, showBuiltInRole: showBasicRoleOnLabel }))) : (React.createElement("div", { className: styles.wrapper },
        showBasicRoleOnLabel && React.createElement(ValueContainer, null, basicRole),
        appliedRoles.map((role) => (React.createElement(ValueContainer, { key: role.uid }, role.displayName || role.name))),
        !disabled && (React.createElement("input", Object.assign({}, rest, { className: styles.input, ref: inputRef, onMouseDown: stopPropagation, onChange: onInputChange, "data-testid": "role-picker-input", placeholder: isFocused ? 'Select role' : '', value: query }))),
        React.createElement("div", { className: styles.suffix },
            React.createElement(Icon, { name: "angle-up", className: styles.dropdownIndicator, onMouseDown: onClose }))));
};
RolePickerInput.displayName = 'RolePickerInput';
export const RolesLabel = ({ showBuiltInRole, numberOfRoles, appliedRoles }) => {
    const styles = useStyles2((theme) => getTooltipStyles(theme));
    return (React.createElement(React.Fragment, null, !!numberOfRoles ? (React.createElement(Tooltip, { content: React.createElement("div", { className: styles.tooltip }, appliedRoles === null || appliedRoles === void 0 ? void 0 : appliedRoles.map((role) => React.createElement("p", { key: role.uid }, role.displayName))) },
        React.createElement(ValueContainer, null, `${showBuiltInRole ? '+' : ''}${numberOfRoles} role${numberOfRoles > 1 ? 's' : ''}`))) : (!showBuiltInRole && React.createElement(ValueContainer, null, "No roles assigned"))));
};
const getRolePickerInputStyles = (theme, invalid, focused, disabled, withPrefix) => {
    const styles = getInputStyles({ theme, invalid });
    return {
        wrapper: cx(styles.wrapper, sharedInputStyle(theme, invalid), focused &&
            css `
          ${styleMixins.focusCss(theme.v1)}
        `, disabled && styles.inputDisabled, css `
        min-width: ${ROLE_PICKER_WIDTH}px;
        min-height: 32px;
        height: auto;
        flex-direction: row;
        padding-right: 24px;
        max-width: 100%;
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-start;
        position: relative;
        box-sizing: border-box;
        cursor: default;
      `, withPrefix &&
            css `
          padding-left: 0;
        `),
        input: cx(sharedInputStyle(theme, invalid), css `
        max-width: 120px;
        border: none;
        cursor: ${focused ? 'default' : 'pointer'};
      `),
        suffix: styles.suffix,
        dropdownIndicator: css `
      cursor: pointer;
    `,
        selectedRoles: css `
      display: flex;
      align-items: center;
      cursor: ${disabled ? 'not-allowed' : 'pointer'};
    `,
        tooltip: css `
      p {
        margin-bottom: ${theme.spacing(0.5)};
      }
    `,
    };
};
const getTooltipStyles = (theme) => ({
    tooltip: css `
    p {
      margin-bottom: ${theme.spacing(0.5)};
    }
  `,
});
//# sourceMappingURL=RolePickerInput.js.map