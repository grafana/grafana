import { cx } from '@emotion/css';
import React from 'react';
import { Checkbox, Icon, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { getStyles } from './styles';
export const RoleMenuOption = React.forwardRef(({ data, isFocused, isSelected, disabled, onChange, hideDescription }, ref) => {
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const customStyles = useStyles2(getStyles);
    const wrapperClassName = cx(styles.option, isFocused && styles.optionFocused, disabled && customStyles.menuOptionDisabled);
    const onChangeInternal = (event) => {
        if (disabled) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        onChange(data);
    };
    return (
    // TODO: fix keyboard a11y
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    React.createElement("div", { ref: ref, className: wrapperClassName, "aria-label": "Role picker option", onClick: onChangeInternal },
        React.createElement(Checkbox, { value: isSelected, className: customStyles.menuOptionCheckbox, onChange: onChangeInternal, disabled: disabled }),
        React.createElement("div", { className: cx(styles.optionBody, customStyles.menuOptionBody) },
            React.createElement("span", null, data.displayName || data.name),
            !hideDescription && data.description && React.createElement("div", { className: styles.optionDescription }, data.description)),
        data.description && (React.createElement(Tooltip, { content: data.description },
            React.createElement(Icon, { name: "info-circle", className: customStyles.menuOptionInfoSign })))));
});
RoleMenuOption.displayName = 'RoleMenuOption';
//# sourceMappingURL=RoleMenuOption.js.map